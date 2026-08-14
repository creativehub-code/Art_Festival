const crypto = require("crypto");

// 1. Generate and set the CSRF token cookie
const setCsrfToken = (req, res) => {
  const token = crypto.randomBytes(32).toString("hex");
  
  // Set the token in an httpOnly cookie
  res.cookie("csrfToken", token, {
    httpOnly: true, // Frontend cannot read this cookie via JS
    secure: true,   // Required for cross-origin (Render)
    sameSite: "none", // Required for cross-origin
  });
  
  // Send the SAME token to the frontend in the JSON response payload
  res.json({ csrfToken: token });
};

// 2. Validate the CSRF token on state-changing requests
const validateCsrf = (req, res, next) => {
  // Exempt specific routes where the user hasn't authenticated yet
  const skipRoutes = ["/api/auth/login", "/api/auth/setup"];
  if (skipRoutes.includes(req.path)) {
    return next();
  }

  // Only protect state-changing requests
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const headerToken = req.headers["x-csrf-token"];
    const cookieToken = req.cookies["csrfToken"];

    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      return res.status(403).json({ 
        message: "CSRF validation failed. Missing or invalid token." 
      });
    }
  }
  
  next();
};

module.exports = { setCsrfToken, validateCsrf };
