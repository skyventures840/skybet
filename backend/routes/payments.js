const express = require('express')
const router = express.Router()
const { auth } = require('../middleware/auth')
const { body, validationResult } = require('express-validator')
const nowpayments = require('../services/nowpayments')
const Payment = require('../models/Payment')
const User = require('../models/User')
const Transaction = require('../models/Transaction')
const PromoCode = require('../models/PromoCode')
const PromoUsage = require('../models/PromoUsage')

// Helper functions for mock payments
function generateMockAddress (currency) {
  const addresses = {
    BTC: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    ETH: '0x742d35Cc6634C0532925a3b8D49d7e8E9c2d4b7f',
    LTC: 'LTC1234567890abcdef1234567890abcdef12345678',
    BCH: 'bitcoincash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy',
    XRP: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
    USDT: '0x742d35Cc6634C0532925a3b8D49d7e8E9c2d4b7f', // USDT ERC20 (Ethereum)
    USDTTRC20: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' // USDT TRC20 (TRON)
  }
  return addresses[currency.toUpperCase()] || addresses.BTC
}

function calculateMockPayAmount (usdAmount, currency) {
  // Mock exchange rates for demonstration
  const mockRates = {
    BTC: 45000, // 1 BTC = $45,000
    ETH: 2500, // 1 ETH = $2,500
    LTC: 100, // 1 LTC = $100
    BCH: 300, // 1 BCH = $300
    XRP: 0.5, // 1 XRP = $0.50
    USDT: 1, // 1 USDT ERC20 = $1
    USDTTRC20: 1 // 1 USDT TRC20 = $1
  }

  const rate = mockRates[currency.toUpperCase()] || mockRates.BTC
  return parseFloat((usdAmount / rate).toFixed(8))
}

// Check API Status
router.get('/status', async (req, res) => {
  try {
    const status = await nowpayments.checkApiStatus()
    res.json(status)
  } catch (error) {
    nowpayments.logger.error('API status check failed:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Get Available Currencies
router.get('/currencies', async (req, res) => {
  try {
    const currencies = await nowpayments.getAvailableCurrencies()
    res.json(currencies)
  } catch (error) {
    nowpayments.logger.error('Failed to get currencies:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Create Payment
router.post('/create', auth, [
  body('amount').isFloat({ min: 10 }),
  body('currency').isString().notEmpty(),
  body('description').optional().isString(),
  body('promoCode').optional().isString(),
  body('referralCode').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { amount, currency, description, promoCode, referralCode } = req.body
    const userId = req.user.id

    // Generate unique order ID
    const orderId = `order_${Date.now()}_${userId}_${Math.random().toString(36).substr(2, 9)}`

    const paymentData = {
      price_amount: parseFloat(amount),
      price_currency: 'USD', // Fiat currency for pricing
      pay_currency: currency.toUpperCase(), // Crypto currency for payment
      order_id: orderId,
      order_description: description || 'Betting Payment',
      ipn_callback_url: nowpayments.config.callbackUrl,
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account?tab=deposit&status=success`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account?tab=deposit&status=cancelled`
    }

    // Log the payment attempt
    nowpayments.logger.info('Attempting to create payment:', {
      orderId,
      amount: paymentData.price_amount,
      currency: paymentData.pay_currency,
      userId
    })

    let payment

    try {
      // Try to create payment with NOWPayments
      payment = await nowpayments.createPayment(paymentData)

      // If NOWPayments did not provide an address immediately, try fetching status
      if (!payment.pay_address || !payment.pay_currency) {
        try {
          const statusResp = await nowpayments.getPaymentStatus(payment.payment_id)
          payment.pay_address = payment.pay_address || statusResp.pay_address
          payment.pay_currency = payment.pay_currency || statusResp.pay_currency
          payment.payin_extra_id = payment.payin_extra_id || statusResp.payin_extra_id || statusResp.payinExtraId
          payment.payment_url = payment.payment_url || statusResp.payment_url || statusResp.paymentUrl
          payment.invoice_url = payment.invoice_url || statusResp.invoice_url || statusResp.invoiceUrl
        } catch (statusErr) {
          nowpayments.logger.warn('Address not available after create; status fetch failed', statusErr.message)
        }
      }

      // Save payment to database
      await Payment.createPayment({
        userId,
        orderId,
        paymentId: payment.payment_id,
        status: payment.payment_status,
        amount: paymentData.price_amount,
        currency: paymentData.price_currency,
        payAmount: payment.pay_amount,
        payCurrency: payment.pay_currency || paymentData.pay_currency,
        // Address may not be present immediately; store empty string to allow later update
        payAddress: payment.pay_address || '',
        payinExtraId: payment.payin_extra_id,
        paymentExtraId: payment.payment_extra_id,
        purchaseId: payment.purchase_id,
        orderDescription: paymentData.order_description,
        ipnCallbackUrl: paymentData.ipn_callback_url,
        successUrl: paymentData.success_url,
        cancelUrl: paymentData.cancel_url
      })
    } catch (nowpaymentsError) {
      nowpayments.logger.error('NOWPayments API error:', nowpaymentsError.message)

      // Check if this is a rate limiting error (429) or network error
      if (nowpaymentsError.message.includes('429') ||
          nowpaymentsError.message.includes('Too Many Requests') ||
          nowpaymentsError.message.includes('ENOTFOUND') ||
          nowpaymentsError.message.includes('ECONNREFUSED') ||
          nowpaymentsError.message.includes('timeout') ||
          process.env.USE_MOCK_PAYMENTS === 'true') {
        // Create a mock payment for testing/fallback
        nowpayments.logger.info('Creating mock payment due to API unavailability or rate limiting')

        const mockPayment = {
          payment_id: `mock_${Date.now()}_${userId}_${Math.random().toString(36).substr(2, 9)}`,
          payment_status: 'waiting',
          pay_amount: calculateMockPayAmount(paymentData.price_amount, paymentData.pay_currency),
          pay_currency: paymentData.pay_currency,
          pay_address: generateMockAddress(paymentData.pay_currency),
          price_amount: paymentData.price_amount,
          price_currency: paymentData.price_currency,
          order_description: paymentData.order_description,
          order_id: orderId
        }

        payment = mockPayment

        // Save mock payment to database
        await Payment.createPayment({
          userId,
          orderId,
          paymentId: payment.payment_id,
          status: payment.payment_status,
          amount: paymentData.price_amount,
          currency: paymentData.price_currency,
          payAmount: payment.pay_amount,
          payCurrency: payment.pay_currency,
          payAddress: payment.pay_address,
          orderDescription: paymentData.order_description,
          ipnCallbackUrl: paymentData.ipn_callback_url,
          successUrl: paymentData.success_url,
          cancelUrl: paymentData.cancel_url
        })
      } else {
        throw new Error(`Payment service unavailable: ${nowpaymentsError.message}. Please try again later or contact support.`)
      }
    }

    // Create transaction record
    const transaction = new Transaction({
      userId,
      type: 'deposit',
      amount: paymentData.price_amount,
      method: 'crypto',
      currency: (payment.pay_currency || paymentData.pay_currency || 'USD').toUpperCase(),
      status: 'pending',
      description: `Crypto deposit via ${(payment.pay_currency || paymentData.pay_currency || 'USD').toUpperCase()}`,
      metadata: {
        paymentId: payment.payment_id,
        orderId,
        payAddress: payment.pay_address,
        promoCode: promoCode || null,
        referralCode: referralCode || null
      }
    })

    await transaction.save()

    nowpayments.logger.info('Payment created successfully:', {
      orderId,
      paymentId: payment.payment_id,
      userId,
      status: payment.payment_status
    })

    // If we still don't have an address, inform frontend to use hosted page or poll status
    const isManualProcessing = !payment.pay_address && !process.env.USE_MOCK_PAYMENTS

    res.json({
      success: true,
      payment: {
        paymentId: payment.payment_id,
        orderId,
        status: payment.payment_status,
        amount: payment.pay_amount,
        currency: payment.pay_currency,
        address: payment.pay_address,
        paymentStatus: payment.payment_status,
        payAddress: payment.pay_address,
        payAmount: payment.pay_amount,
        payCurrency: payment.pay_currency,
        priceAmount: payment.price_amount,
        priceCurrency: payment.price_currency,
        orderDescription: payment.order_description,
        payinExtraId: payment.payin_extra_id,
        paymentUrl: payment.payment_url,
        invoiceUrl: payment.invoice_url,
        isMockPayment: payment.payment_id && payment.payment_id.startsWith('mock_'),
        isManualProcessing
      }
    })
  } catch (error) {
    nowpayments.logger.error('Create payment error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      body: req.body
    })
    res.status(500).json({
      error: 'Failed to create payment',
      details: error.message,
      suggestion: 'Please try again or contact support if the issue persists'
    })
  }
})

// Get Payment Status
router.get('/status/:paymentId', auth, async (req, res) => {
  try {
    const { paymentId } = req.params
    const status = await nowpayments.getPaymentStatus(paymentId)
    res.json(status)
  } catch (error) {
    nowpayments.logger.error('Failed to get payment status:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Get User Payments
router.get('/user', auth, async (req, res) => {
  try {
    const { status } = req.query
    const payments = await Payment.getByUser(req.user.id, status)
    res.json(payments)
  } catch (error) {
    nowpayments.logger.error('Failed to get user payments:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Handle IPN Callbacks
router.post('/callback', async (req, res) => {
  const receivedSignature = req.headers['x-nowpayments-sig']
  const body = req.body

  // Verify IPN signature
  if (!nowpayments.verifyIpnSignature(body, receivedSignature)) {
    nowpayments.logger.error('Invalid IPN signature:', {
      received: receivedSignature,
      body
    })
    return res.status(401).json({ error: 'Invalid signature' })
  }

  try {
    const {
      payment_id: paymentId,
      payment_status: paymentStatus,
      order_id: orderId,
      pay_amount: payAmount,
      pay_currency: payCurrency,
      pay_address: payAddress,
      outcome_amount: outcomeAmount,
      outcome_currency: outcomeCurrency,
      outcome_network: outcomeNetwork,
      outcome_txid: outcomeTxid,
      outcome_address: outcomeAddress,
      outcome_extra_id: outcomeExtraId,
      outcome_amount_converted: outcomeAmountConverted,
      outcome_currency_converted: outcomeCurrencyConverted,
      partially_paid_amount: partiallyPaidAmount,
      partially_paid_amount_converted: partiallyPaidAmountConverted
    } = body

    nowpayments.logger.info('IPN received:', {
      payment_id: paymentId,
      payment_status: paymentStatus,
      order_id: orderId
    })

    // Update payment status in database
    const updateData = {
      status: paymentStatus,
      payAmount,
      payCurrency,
      payAddress,
      outcomeAmount,
      outcomeCurrency,
      outcomeNetwork,
      outcomeTxid,
      outcomeAddress,
      outcomeExtraId,
      outcomeAmountConverted,
      outcomeCurrencyConverted,
      partiallyPaidAmount,
      partiallyPaidAmountConverted
    }

    const payment = await Payment.updatePaymentStatus(orderId, paymentStatus, updateData)

    if (payment) {
      // Update transaction status
      const transaction = await Transaction.findOne({
        userId: payment.userId,
        type: 'deposit',
        'metadata.paymentId': paymentId
      })

      if (transaction) {
        if (paymentStatus === 'finished' || paymentStatus === 'confirmed') {
          // Credit real wallet
          await User.deposit(payment.userId, payment.amount)

          // First-deposit check and bonus
          const user = await User.findById(payment.userId)
          const isFirstDeposit = !user.hasDeposited
          const now = new Date()
          if (isFirstDeposit) {
            await User.findByIdAndUpdate(payment.userId, { $set: { hasDeposited: true, firstDepositAt: now } })
            const welcomePercent = 100
            const welcomeBonus = Math.floor(payment.amount * welcomePercent) / 100
            if (welcomeBonus > 0) {
              const wrMult = 5
              await User.creditBonus(payment.userId, welcomeBonus, welcomeBonus * wrMult)
            }
          }

          // Apply promo/referral from transaction metadata if present
          const codeStr = String(transaction?.metadata?.promoCode || '').toUpperCase().trim()
          const refCode = String(transaction?.metadata?.referralCode || '').trim()
          if (codeStr) {
            const promo = await PromoCode.findOne({ code: codeStr, isActive: true })
            if (promo) {
              const alreadyUsed = await PromoUsage.findOne({ userId: payment.userId, code: promo.code })
              if (!promo.oneTimePerUser || !alreadyUsed) {
                if (promo.type === 'FIRST_DEPOSIT' && isFirstDeposit) {
                  let bonus = 0
                  if (promo.percent && promo.percent > 0) {
                    bonus = (payment.amount * promo.percent) / 100
                    if (promo.maxBonus && bonus > promo.maxBonus) bonus = promo.maxBonus
                  } else if (promo.fixedAmount && promo.fixedAmount > 0) {
                    bonus = promo.fixedAmount
                  }
                  if (bonus > 0) {
                    const wrInc = bonus * (promo.wageringMultiplier || 5)
                    await User.creditBonus(payment.userId, bonus, wrInc)
                    await new PromoUsage({
                      userId: payment.userId,
                      promoCodeId: promo._id,
                      code: promo.code,
                      type: promo.type,
                      context: 'deposit',
                      amountAwarded: bonus,
                      metadata: { paymentId: payment.paymentId }
                    }).save()
                  }
                } else if (promo.type === 'REFERRAL' && refCode) {
                  const referrer = await User.findOne({ referralCode: refCode })
                  if (referrer && String(referrer._id) !== String(payment.userId)) {
                    const referrerBonus = Number(promo.referrerBonus || 0)
                    const refereeBonus = Number(promo.refereeBonus || 0)
                    if (refereeBonus > 0) {
                      const wrReferee = refereeBonus * (promo.wageringMultiplier || 5)
                      await User.creditBonus(payment.userId, refereeBonus, wrReferee)
                    }
                    if (referrerBonus > 0) {
                      const wrReferrer = referrerBonus * (promo.wageringMultiplier || 5)
                      await User.creditBonus(referrer._id, referrerBonus, wrReferrer)
                    }
                    await new PromoUsage({
                      userId: payment.userId,
                      promoCodeId: promo._id,
                      code: promo.code,
                      type: promo.type,
                      context: 'deposit',
                      amountAwarded: refereeBonus,
                      referrerId: referrer._id,
                      refereeId: payment.userId,
                      metadata: { paymentId: payment.paymentId }
                    }).save()
                  }
                }
              }
            }
          }

          // Complete transaction
          await Transaction.completeTransaction(transaction._id, outcomeTxid)
          nowpayments.logger.info('Payment completed and balance updated with bonuses:', {
            userId: payment.userId,
            amount: payment.amount,
            orderId
          })
        } else if (paymentStatus === 'failed' || paymentStatus === 'expired') {
          // Mark transaction as failed
          await Transaction.failTransaction(transaction._id, `Payment ${paymentStatus}`)

          nowpayments.logger.info('Payment failed:', {
            userId: payment.userId,
            orderId,
            status: paymentStatus
          })
        }
      } else {
        nowpayments.logger.warn(`Transaction not found for paymentId: ${paymentId}`)
      }
    } else {
      nowpayments.logger.warn(`Payment not found for orderId: ${orderId}`)
    }

    res.status(200).send('OK')
  } catch (error) {
    nowpayments.logger.error('IPN processing failed:', error.message)
    res.status(500).json({ error: 'IPN processing failed' })
  }
})

module.exports = router
