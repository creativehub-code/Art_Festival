const sendError = (res, statusCode, userMessage, error) => {
  console.error(`[${statusCode}] ${userMessage}:`, error?.message || error);
  res.status(statusCode).json({ 
    message: process.env.NODE_ENV === 'production' 
      ? userMessage 
      : `${userMessage}: ${error?.message}` 
  });
};

module.exports = sendError;
