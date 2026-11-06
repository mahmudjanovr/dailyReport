export function notFoundHandler(req, res) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `API route not found: ${req.method} ${req.originalUrl}`,
      },
    });
  }

  return res.status(404).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>404 - Page Not Found | Operator Daily Report</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 4rem 1rem; color: #2d3748; background: #f7fafc; }
        h1 { font-size: 3rem; margin-bottom: 0.5rem; color: #e53e3e; }
        p { font-size: 1.25rem; margin-bottom: 2rem; color: #4a5568; }
        a { display: inline-block; padding: 0.75rem 1.5rem; background: #3182ce; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500; }
        a:hover { background: #2b6cb0; }
      </style>
    </head>
    <body>
      <h1>404</h1>
      <p>The requested page was not found.</p>
      <a href="/">Return to Dashboard</a>
    </body>
    </html>
  `);
}
