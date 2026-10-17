const { google } = require('googleapis');

/**
 * Updates a Google Sheet with participant marks and ranks.
 * @param {string} sheetId - The ID of the Google Sheet.
 * @param {string} tabName - The name of the tab to update (e.g., Program Name).
 * @param {Array<Array<string|number>>} data - The data rows (including headers).
 */
async function updateGoogleSheet(sheetId, tabName, data) {
    const fs = require('fs');
    const path = require('path');
    let auth;

    // Prioritize environment variable JSON string
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        try {
            const keyData = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
            auth = google.auth.fromJSON(keyData);
            auth.scopes = ['https://www.googleapis.com/auth/spreadsheets'];
        } catch (e) {
            console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_JSON:', e.message);
        }
    }

    // Fallback to local file (development only)
    if (!auth) {
        const keyFilePath = path.join(__dirname, '../service-account.json');
        if (fs.existsSync(keyFilePath)) {
            const keyData = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
            auth = google.auth.fromJSON(keyData);
            auth.scopes = ['https://www.googleapis.com/auth/spreadsheets'];
        }
    }

    // Ultimate fallback for individual environment variables
    if (!auth) {
        auth = new google.auth.JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/\r/g, '').trim() : undefined,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
        // Explicitly authorize to ensure we have a token
        await auth.authorize();

        // 1. Check if the tab exists, create if not
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheetExists = spreadsheet.data.sheets.some(s => s.properties.title === tabName);

        if (!sheetExists) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: sheetId,
                requestBody: {
                    requests: [{
                        addSheet: {
                            properties: { title: tabName }
                        }
                    }]
                }
            });
        }

        // 2. Clear existing content in the tab
        await sheets.spreadsheets.values.clear({
            spreadsheetId: sheetId,
            range: `${tabName}!A1:Z500`,
        });

        // 3. Update with new data
        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${tabName}!A1`,
            valueInputOption: 'RAW',
            requestBody: {
                values: data,
            },
        });

        return { success: true };
    } catch (error) {
        console.error('Google Sheets Update Error:', error);
        
        // Handle specific Google API error responses
        if (error.response && error.response.data && error.response.data.error) {
            const apiError = error.response.data.error;
            if (apiError.status === 'PERMISSION_DENIED') {
                throw new Error(`Permission Denied: Ensure the Service Account email (${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}) is added as an EDITOR to the Google Sheet.`);
            }
            throw new Error(`Google API Error: ${apiError.message}`);
        }
        
        throw new Error(`Failed to update Google Sheet: ${error.message}`);
    }
}

module.exports = { updateGoogleSheet };
