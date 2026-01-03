const jwt = require('jsonwebtoken')
const config = require('../config/config')
const User = require('../models/User')

// Regular authentication middleware
const auth = async (req, res, next) => {
  try {
    let token;
    // Robust header extraction to support both Express and Fastify/Node requests
    if (typeof req.header === 'function') {
      token = req.header('Authorization');
    } else if (req.headers && req.headers.authorization) {
      token = req.headers.authorization;
    } else if (req.headers && req.headers.Authorization) {
      token = req.headers.Authorization;
    }

    if (token) {
      token = token.replace('Bearer ', '')
    }

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' })
    }
    const decoded = jwt.verify(token, config.jwtSecret)
    const user = await User.findById(decoded.id)
    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' })
    }
    if (user.isBlocked) {
      return res.status(403).json({ error: 'Account is blocked.' })
    }
    req.user = user
    next()
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' })
  }
}

// Admin authentication middleware
const adminAuth = async (req, res, next) => {
  try {
    let token;
    // Robust header extraction to support both Express and Fastify/Node requests
    if (typeof req.header === 'function') {
      token = req.header('Authorization');
    } else if (req.headers && req.headers.authorization) {
      token = req.headers.authorization;
    } else if (req.headers && req.headers.Authorization) {
      token = req.headers.Authorization;
    }

    if (token) {
      token = token.replace('Bearer ', '')
    }

    if (!token) {
      console.log('[Auth Debug] Access denied. No token provided.')
      return res.status(401).json({ error: 'Access denied. No token provided.' })
    }
    const decoded = jwt.verify(token, config.jwtSecret)
    const user = await User.findById(decoded.id)
    if (!user) {
      console.log('[Auth Debug] Invalid token. User not found.', decoded.id)
      return res.status(401).json({ error: 'Invalid token. User not found.' })
    }
    if (user.isBlocked) {
      console.log('[Auth Debug] Account is blocked.', user._id)
      return res.status(403).json({ error: 'Account is blocked.' })
    }
    if (!user.isAdmin) {
      console.log('[Auth Debug] Access denied. Admin privileges required.', user._id)
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' })
    }
    req.user = user
    next()
  } catch (error) {
    console.error('[Auth Debug] Invalid token error:', error.message, error.stack)
    res.status(401).json({ error: 'Invalid token.' })
  }
}

module.exports = { auth, adminAuth }
