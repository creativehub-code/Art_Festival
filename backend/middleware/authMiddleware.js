const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Judge = require('../models/Judge');

const protect = async (req, res, next) => {
  try {
    let token;

    // 1) Extract token from cookie or Authorization header (fallback)
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        message: 'You are not logged in! Please log in to get access.',
      });
    }

    // 2) Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Check if user still exists in DB
    let currentUser;
    if (decoded.role === 'admin') {
      currentUser = await Admin.findById(decoded.id);
    } else if (decoded.role === 'judge') {
      currentUser = await Judge.findById(decoded.id);
    }

    if (!currentUser) {
      return res.status(401).json({
        message: 'The user belonging to this token no longer exists.',
      });
    }

    // 4) Grant access to protected route
    req.user = currentUser;
    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired token.',
    });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'You do not have permission to perform this action',
      });
    }
    
    next();
  };
};

module.exports = { protect, restrictTo };
