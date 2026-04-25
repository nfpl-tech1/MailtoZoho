/**
 * Test Script for Email Notification Service
 * Run this to verify email notifications are working correctly
 */

require('dotenv').config();
const { getNotificationService } = require('../src/services/common/email-notification');

async function testEmailNotification() {
    console.log('\n' + '='.repeat(70));
    console.log('📧 TESTING EMAIL NOTIFICATION SERVICE');
    console.log('='.repeat(70) + '\n');

    try {
        // Initialize the notification service
        console.log('1️⃣ Initializing notification service...');
        const notificationService = await getNotificationService();

        if (!notificationService.isReady()) {
            console.error('❌ Notification service is not ready!');
            console.error('   Check your .env file for:');
            console.error('   - ERROR_NOTIFICATION_EMAILS');
            console.error('   - GMAIL_USER');
            console.error('   - GMAIL_APP_PASSWORD');
            process.exit(1);
        }

        console.log('✅ Notification service initialized successfully\n');

        // Test 1: Single failure notification
        console.log('2️⃣ Testing single failure notification...');
        const singleFailure = {
            beNumber: '6041692',
            queryDate: '13-Dec-2025',
            query: 'PGA NOC PENDING - Test Query',
            error: 'No job found in View_All_Jobs for BE_No: 6041692',
            jobNo: null
        };

        const singleResult = await notificationService.sendQueryFailureNotification(
            singleFailure,
            'Record Query (TEST)'
        );

        if (singleResult.success) {
            console.log('✅ Single failure notification sent successfully');
            console.log(`   Message ID: ${singleResult.messageId}`);
            console.log(`   Recipients: ${singleResult.recipients.join(', ')}\n`);
        } else {
            console.error('❌ Failed to send single notification:', singleResult.error);
        }

        // Test 2: Batch failure notification
        console.log('3️⃣ Testing batch failure notification...');
        const batchFailures = [
            {
                beNumber: '6041692',
                queryDate: '13-Dec-2025',
                query: 'PGA NOC PENDING',
                error: 'No job found in View_All_Jobs for BE_No: 6041692',
                jobNo: null
            },
            {
                beNumber: '6041693',
                queryDate: '14-Dec-2025',
                query: 'CUSTOM CLEARANCE STATUS',
                error: 'No job found in View_All_Jobs for BE_No: 6041693',
                jobNo: null
            },
            {
                beNumber: '6041694',
                queryDate: '15-Dec-2025',
                query: 'CERTIFICATE OF ORIGIN',
                error: 'Zoho API rate limit exceeded',
                jobNo: 'JOB123456'
            }
        ];

        const batchResult = await notificationService.sendBatchFailureNotification(
            batchFailures,
            'Record Query (TEST)'
        );

        if (batchResult.success) {
            console.log('✅ Batch failure notification sent successfully');
            console.log(`   Message ID: ${batchResult.messageId}`);
            console.log(`   Recipients: ${batchResult.recipients.join(', ')}`);
            console.log(`   Failures reported: ${batchResult.failureCount}\n`);
        } else {
            console.error('❌ Failed to send batch notification:', batchResult.error);
        }

        console.log('='.repeat(70));
        console.log('✅ ALL TESTS COMPLETED');
        console.log('='.repeat(70));
        console.log('\n📬 Check your email inbox for test notifications!');
        console.log('   (Check spam folder if you don\'t see them)\n');

    } catch (error) {
        console.error('\n❌ Test failed with error:');
        console.error(error);
        process.exit(1);
    }
}

// Run the test
testEmailNotification();
