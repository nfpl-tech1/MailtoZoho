/**
 * Email Templates
 * HTML and text templates for failure notifications
 */

/**
 * Generate single failure email content
 * @param {Object} failure - Failure details
 * @param {string} workflow - Workflow name
 * @returns {Object} { subject, html, text }
 */
function generateSingleFailureEmail(failure, workflow) {
    const { beNumber, queryDate, query, error, jobNo } = failure;
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const subject = `[${workflow}] Query Insertion Failed - BE: ${beNumber}`;

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #dc3545; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
                .content { background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
                .field { margin-bottom: 15px; }
                .field-label { font-weight: bold; color: #495057; }
                .field-value { margin-top: 5px; padding: 10px; background-color: white; border-left: 3px solid #007bff; }
                .error-box { background-color: #fff3cd; border-left: 3px solid #ffc107; padding: 10px; margin-top: 10px; }
                .footer { margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 0 0 5px 5px; font-size: 12px; color: #6c757d; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2 style="margin: 0;">⚠️ Query Insertion Failure Alert</h2>
                </div>
                <div class="content">
                    <p><strong>Workflow:</strong> ${workflow}</p>
                    <p><strong>Timestamp:</strong> ${timestamp}</p>
                    
                    <div class="field">
                        <div class="field-label">BE Number:</div>
                        <div class="field-value">${beNumber || 'N/A'}</div>
                    </div>

                    ${jobNo ? `
                    <div class="field">
                        <div class="field-label">Job Number:</div>
                        <div class="field-value">${jobNo}</div>
                    </div>
                    ` : ''}

                    <div class="field">
                        <div class="field-label">Query Date:</div>
                        <div class="field-value">${queryDate || 'N/A'}</div>
                    </div>

                    <div class="field">
                        <div class="field-label">Query:</div>
                        <div class="field-value">${query || 'N/A'}</div>
                    </div>

                    <div class="field">
                        <div class="field-label">Error:</div>
                        <div class="error-box">${error || 'Unknown error'}</div>
                    </div>
                </div>
                <div class="footer">
                    <p>This is an automated notification from the eSanchit Backend System.</p>
                    <p>Please investigate the issue and take appropriate action.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    const text = `
QUERY INSERTION FAILURE ALERT

Workflow: ${workflow}
Timestamp: ${timestamp}

BE Number: ${beNumber || 'N/A'}
${jobNo ? `Job Number: ${jobNo}\n` : ''}Query Date: ${queryDate || 'N/A'}
Query: ${query || 'N/A'}

Error: ${error || 'Unknown error'}

---
This is an automated notification from the eSanchit Backend System.
Please investigate the issue and take appropriate action.
    `.trim();

    return { subject, html, text };
}

/**
 * Generate batch failure email content
 * @param {Array} failures - Array of failure objects
 * @param {string} workflow - Workflow name
 * @returns {Object} { subject, html, text }
 */
function generateBatchFailureEmail(failures, workflow) {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const subject = `[${workflow}] ${failures.length} Query Insertion Failure(s)`;

    const failureRows = failures.map((f, index) => `
        <tr style="${index % 2 === 0 ? 'background-color: #f8f9fa;' : ''}">
            <td style="padding: 10px; border: 1px solid #dee2e6;">${f.beNumber || 'N/A'}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${f.queryDate || 'N/A'}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${f.query ? (f.query.length > 50 ? f.query.substring(0, 50) + '...' : f.query) : 'N/A'}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6; color: #dc3545;">${f.error || 'Unknown'}</td>
        </tr>
    `).join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 800px; margin: 0 auto; padding: 20px; }
                .header { background-color: #dc3545; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
                .content { background-color: white; padding: 20px; border: 1px solid #dee2e6; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th { background-color: #007bff; color: white; padding: 12px; text-align: left; border: 1px solid #0056b3; }
                .footer { margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 0 0 5px 5px; font-size: 12px; color: #6c757d; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2 style="margin: 0;">⚠️ Multiple Query Insertion Failures</h2>
                </div>
                <div class="content">
                    <p><strong>Workflow:</strong> ${workflow}</p>
                    <p><strong>Timestamp:</strong> ${timestamp}</p>
                    <p><strong>Total Failures:</strong> ${failures.length}</p>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>BE Number</th>
                                <th>Query Date</th>
                                <th>Query</th>
                                <th>Error</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${failureRows}
                        </tbody>
                    </table>
                </div>
                <div class="footer">
                    <p>This is an automated notification from the eSanchit Backend System.</p>
                    <p>Please investigate these issues and take appropriate action.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    const text = `
MULTIPLE QUERY INSERTION FAILURES

Workflow: ${workflow}
Timestamp: ${timestamp}
Total Failures: ${failures.length}

${failures.map((f, i) => `
${i + 1}. BE Number: ${f.beNumber || 'N/A'}
   Query Date: ${f.queryDate || 'N/A'}
   Query: ${f.query || 'N/A'}
   Error: ${f.error || 'Unknown'}
`).join('\n')}

---
This is an automated notification from the eSanchit Backend System.
Please investigate these issues and take appropriate action.
    `.trim();

    return { subject, html, text };
}

module.exports = {
    generateSingleFailureEmail,
    generateBatchFailureEmail
};
