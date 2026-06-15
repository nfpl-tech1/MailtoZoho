/**
 * Error Handler Middleware
 * Centralized error handling for the application
 */

/**
 * Not Found Handler
 * Catches 404 errors for undefined routes
 */
const notFound = (req, res, next) => {
    // Silently ignore favicon and stray Next.js HMR requests
    if (req.originalUrl === '/favicon.ico' || req.originalUrl.startsWith('/_next/')) {
        return res.status(204).end();
    }
    
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.status = 404;
    next(error);
};

/**
 * Global Error Handler
 * Handles all errors passed to next()
 */
const errorHandler = (err, req, res, next) => {
    // Log error for debugging
    console.error('❌ Error:', err.message);
    if (process.env.NODE_ENV === 'development') {
        console.error(err.stack);
    }

    // Determine status code
    const statusCode = err.status || err.statusCode || 500;

    // Send error response
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
            details: err.details
        })
    });
};

module.exports = {
    notFound,
    errorHandler
};
