require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Bet = require('../models/Bet');
const MultiBet = require('../models/MultiBet');
const Results = require('../models/Results');
const Scores = require('../models/Scores');
const Odds = require('../models/Odds');
const { OddsApiService } = require('../services/oddsApiService');
const betSettlementService = require('../services/betSettlementService');

const args = process.argv.slice(2);
const userArgIndex = args.indexOf('--user');
const identifier = userArgIndex !== -1 ? args[userArgIndex + 1] : 'skyventures';
const dryRun = args.includes('--dryRun');

function extractScoresFromResult(result) {
  let homeScore = null;
  let awayScore = null;
  if (result && Array.isArray(result.scores)) {
    const homeScoreData = result.scores.find(s => s.name === result.home_team);
    const awayScoreData = result.scores.find(s => s.name === result.away_team);
    if (homeScoreData && awayScoreData) {
      homeScore = parseInt(homeScoreData.score) || 0;
      awayScore = parseInt(awayScoreData.score) || 0;
    } else if (result.scores.length >= 2) {
      homeScore = parseInt(result.scores[0].score) || 0;
      awayScore = parseInt(result.scores[1].score) || 0;
    }
  }
  return { homeScore, awayScore };
}

async function findMatchingResult(bet) {
  const byId = await Results.findOne({ eventId: bet.matchId, completed: true });
  if (byId) return byId;
  const home = bet.homeTeam ? new RegExp(bet.homeTeam, 'i') : undefined;
  const away = bet.awayTeam ? new RegExp(bet.awayTeam, 'i') : undefined;
  if (home && away) {
    const byTeams = await Results.findOne({ completed: true, home_team: home, away_team: away });
    if (byTeams) return byTeams;
  }
  return null;
}

async function ensureResultFetchedForBet(bet) {
  try {
    const oddsDoc = await Odds.findOne({ gameId: bet.matchId });
    if (!oddsDoc || !oddsDoc.sport_key) return false;
    const service = new OddsApiService();
    if (!service.isEnabled) return false;
    const results = await service.getResults(oddsDoc.sport_key, 7);
    return Array.isArray(results) && results.length > 0;
  } catch (e) {
    return false;
  }
}

async function findMatchingScore(bet) {
  const byId = await Scores.findOne({ eventId: bet.matchId, completed: true });
  if (byId) return byId;
  const home = bet.homeTeam ? new RegExp(bet.homeTeam, 'i') : undefined;
  const away = bet.awayTeam ? new RegExp(bet.awayTeam, 'i') : undefined;
  if (home && away) {
    const byTeams = await Scores.findOne({ completed: true, home_team: home, away_team: away });
    if (byTeams) return byTeams;
  }
  return null;
}

async function pushToBetslip(userId, eventId, homeScore, awayScore) {
  const finalOutcome = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X';
  if (dryRun) return;
  const multiBets = await MultiBet.find({ userId, 'matches.matchId': eventId });
  for (const mb of multiBets) {
    let changed = false;
    mb.matches = (mb.matches || []).map(m => {
      if (String(m.matchId) === String(eventId)) {
        const status = m.outcome === finalOutcome ? 'Win' : 'Loss';
        changed = true;
        return {
          ...m,
          matchStatus: 'Finished',
          status,
          result: { homeScore, awayScore, finalOutcome }
        };
      }
      return m;
    });
    if (changed) {
      mb.updateOverallStatus();
      await mb.save();
    }
  }
  const betsWithLegs = await Bet.find({ userId, 'matches.matchId': eventId });
  for (const b of betsWithLegs) {
    let changed = false;
    b.matches = (b.matches || []).map(m => {
      if (String(m.matchId) === String(eventId)) {
        const status = m.selection && m.selection.toLowerCase().includes('home')
          ? (homeScore > awayScore ? 'won' : 'lost')
          : m.selection && m.selection.toLowerCase().includes('away')
            ? (awayScore > homeScore ? 'won' : 'lost')
            : (finalOutcome === 'X' ? 'won' : 'lost');
        changed = true;
        return {
          ...m,
          status,
          outcome: finalOutcome
        };
      }
      return m;
    });
    if (changed) {
      await b.save();
    }
  }
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_EXTERNAL_URI || process.env.MONGODB_URI);
    const user = await User.findByUsernameOrEmail(identifier);
    if (!user) {
      console.log('User not found:', identifier);
      process.exit(1);
    }

    const pendingBets = await Bet.find({ userId: user._id, status: 'pending' });
    let checked = 0;
    let withResults = 0;
    let settled = 0;
    let pushedLegs = 0;
    let updatedMultibets = 0;

    for (const bet of pendingBets) {
      checked++;
      const legs = Array.isArray(bet.matches) ? bet.matches : [];
      if (legs.length === 0) {
        const result = await findMatchingResult(bet);
        let finalResult = result;
        if (!finalResult) {
          const fetched = await ensureResultFetchedForBet(bet);
          if (fetched) {
            finalResult = await findMatchingResult(bet);
          }
        }
        if (!finalResult) {
          const scoreDoc = await findMatchingScore(bet);
          if (!scoreDoc) continue;
          const { homeScore, awayScore } = extractScoresFromResult({
            scores: scoreDoc.scores,
            home_team: scoreDoc.home_team,
            away_team: scoreDoc.away_team
          });
          if (homeScore === null || awayScore === null) continue;
          await pushToBetslip(user._id, scoreDoc.eventId, homeScore, awayScore);
          pushedLegs++;
          const mbs2 = await MultiBet.find({ userId: user._id, 'matches.matchId': scoreDoc.eventId });
          if (mbs2.length > 0) updatedMultibets += mbs2.length;
          if (!dryRun) {
            const matchMeta = { eventId: scoreDoc.eventId, homeTeam: scoreDoc.home_team, awayTeam: scoreDoc.away_team };
            const ok = await betSettlementService.settleSingleBet(bet, homeScore, awayScore, matchMeta);
            if (ok) settled++;
          }
          continue;
        }
        withResults++;
        const { homeScore, awayScore } = extractScoresFromResult(finalResult);
        if (homeScore === null || awayScore === null) continue;
        await pushToBetslip(user._id, finalResult.eventId, homeScore, awayScore);
        pushedLegs++;
        const mbs = await MultiBet.find({ userId: user._id, 'matches.matchId': finalResult.eventId });
        if (mbs.length > 0) updatedMultibets += mbs.length;
        if (!dryRun) {
          const matchMeta = { eventId: finalResult.eventId, homeTeam: finalResult.home_team, awayTeam: finalResult.away_team };
          const ok = await betSettlementService.settleSingleBet(bet, homeScore, awayScore, matchMeta);
          if (ok) settled++;
        }
      } else {
        for (const leg of legs) {
          const legResult = await Results.findOne({ eventId: leg.matchId, completed: true });
          let finalLegResult = legResult;
          if (!finalLegResult) {
            const fetchedLeg = await ensureResultFetchedForBet({ matchId: leg.matchId, homeTeam: leg.homeTeam, awayTeam: leg.awayTeam });
            if (fetchedLeg) {
              finalLegResult = await Results.findOne({ eventId: leg.matchId, completed: true });
            }
          }
          if (!finalLegResult) {
            const scoreDocLeg = await Scores.findOne({ eventId: leg.matchId, completed: true });
            if (!scoreDocLeg) continue;
            const { homeScore, awayScore } = extractScoresFromResult({
              scores: scoreDocLeg.scores,
              home_team: scoreDocLeg.home_team,
              away_team: scoreDocLeg.away_team
            });
            if (homeScore === null || awayScore === null) continue;
            await pushToBetslip(user._id, scoreDocLeg.eventId, homeScore, awayScore);
            pushedLegs++;
            const mbs3 = await MultiBet.find({ userId: user._id, 'matches.matchId': scoreDocLeg.eventId });
            if (mbs3.length > 0) updatedMultibets += mbs3.length;
          } else {
            withResults++;
            const { homeScore, awayScore } = extractScoresFromResult(finalLegResult);
            if (homeScore === null || awayScore === null) continue;
            await pushToBetslip(user._id, finalLegResult.eventId, homeScore, awayScore);
            pushedLegs++;
            const mbs4 = await MultiBet.find({ userId: user._id, 'matches.matchId': finalLegResult.eventId });
            if (mbs4.length > 0) updatedMultibets += mbs4.length;
          }
        }
      }
    }

    console.log('User', String(user._id));
    console.log('Checked', checked);
    console.log('WithResults', withResults);
    console.log('PushedLegs', pushedLegs);
    console.log('UpdatedMultiBets', updatedMultibets);
    console.log('Settled', settled);
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

run();
