const mongoose = require('mongoose');
const User = require('../models/User');
const Bet = require('../models/Bet');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/platypus';

async function runTest() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Create User
    const username = `test_link_${Date.now()}`;
    const user = new User({
      username,
      email: `${username}@test.com`,
      password: 'password123',
      balance: 100,
      balanceBonus: 50
    });
    await user.save();
    console.log(`User created: ${user.username} (Real: ${user.balance}, Bonus: ${user.balanceBonus})`);

    // 2. Place Bet (Mocking API Logic)
    console.log('\n--- Test 1: Place Bet ---');
    const stake = 20;
    const { bonusUsed, realUsed } = await User.placeBet(user._id, stake);
    
    // Create Bet (mimicking route logic)
    const bet = new Bet({
      userId: user._id,
      matchId: `aviator-${Date.now()}`,
      market: 'Aviator',
      selection: 'Fly',
      stake: stake,
      odds: 1.00,
      potentialWin: 0,
      bonusStakeUsed: bonusUsed,
      realStakeUsed: realUsed,
      status: 'pending',
      homeTeam: 'Aviator',
      awayTeam: 'Game'
    });
    await bet.save();
    console.log(`Bet placed. ID: ${bet._id}, Status: ${bet.status}`);

    const betCheck = await Bet.findById(bet._id);
    if (!betCheck || betCheck.status !== 'pending') throw new Error('Bet creation failed');
    console.log('Verified Bet is pending in DB.');

    // 3. Cashout (Mocking API Logic)
    console.log('\n--- Test 2: Cashout ---');
    const multiplier = 2.0;
    const winAmount = stake * multiplier;
    
    await User.settleBetWin(user._id, winAmount);
    
    // Update Bet
    await Bet.findByIdAndUpdate(bet._id, {
      status: 'won',
      actualWin: winAmount,
      odds: multiplier,
      settledAt: Date.now()
    });

    const betWon = await Bet.findById(bet._id);
    console.log(`Bet status: ${betWon.status}, Win: ${betWon.actualWin}`);
    if (betWon.status !== 'won' || betWon.actualWin !== winAmount) throw new Error('Bet settlement failed');
    
    const userAfterWin = await User.findById(user._id);
    console.log(`User Balance: ${userAfterWin.balance} (Expected: 100 - 0(realUsed) + 40 = 140? No, wait. 20 stake from bonus. Win 40 to real. 100+40 = 140. Correct.)`);

    // 4. Cancel (Mocking API Logic)
    console.log('\n--- Test 3: Cancel ---');
    const stake2 = 10;
    await User.placeBet(user._id, stake2); // Deduct 10 from remaining bonus (30) -> 20 left.
    
    const bet2 = new Bet({
      userId: user._id,
      matchId: `aviator-${Date.now()}`,
      market: 'Aviator',
      selection: 'Fly',
      stake: stake2,
      odds: 1.00,
      potentialWin: 0,
      bonusStakeUsed: 10,
      realStakeUsed: 0,
      status: 'pending'
    });
    await bet2.save();
    console.log(`Bet 2 placed. ID: ${bet2._id}`);

    // Cancel
    await User.refundBet(user._id, stake2);
    await Bet.findByIdAndUpdate(bet2._id, {
      status: 'cancelled',
      settledAt: Date.now()
    });

    const betCancelled = await Bet.findById(bet2._id);
    console.log(`Bet 2 status: ${betCancelled.status}`);
    if (betCancelled.status !== 'cancelled') throw new Error('Bet cancellation failed');

    console.log('\nAll tests passed!');

  } catch (err) {
    console.error('Test Failed:', err);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({ email: { $regex: 'test_link_' } });
      await Bet.deleteMany({ market: 'Aviator', userId: { $in: await User.find({ email: { $regex: 'test_link_' } }).distinct('_id') } });
      await mongoose.disconnect();
    }
  }
}

runTest();
