const SurveyResponse = require('../models/surveyResponseModel');
const fs = require('fs');
const nodemailer = require('nodemailer');
const path = require('path');


const nodemailer_password = process.env.NODEMAILER_PASSWORD;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'support@invicious.in',
        pass: nodemailer_password
    }
});

// Save survey responses
const generateUniqueKYWId = async (programPrefix) => {
    const generateRandomNumber = () => Math.floor(100000 + Math.random() * 900000); 
    const generateRandomAlphaNumeric = () => {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 2; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    };
    
    let uniqueId;
    let isUnique = false;

    while (!isUnique) {
        const randomAlphaNumeric = generateRandomAlphaNumeric();
        const randomNumber = generateRandomNumber();
        uniqueId = `${programPrefix}${randomAlphaNumeric}${randomNumber}`;

        const existingId = await SurveyResponse.findOne({ kywId: uniqueId });
        isUnique = !existingId;
    }

    return uniqueId;
};


exports.submitSurvey = async (req, res) => {
    const { userInfo, mcqData, currentWorth, afterWorth, selectedProgram } = req.body;
    // console.log('Received data:', req.body);

    try {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userInfo.email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        const existingUser = await SurveyResponse.findOne({ 'userInfo.email': userInfo.email });
        if (existingUser) {
            return res.status(400).json({ message: 'You have already submitted the survey.' });
        }

        const selectedMcqData = mcqData.map(question => ({
            question: question.question,
            selectedOption: question.selectedOption,
        }));

        let programPrefix;
        switch (selectedProgram) {
            case 'Design & Creation':
                programPrefix = 'DC';
                break;
            case 'Web Development':
                programPrefix = 'WD';
                break;
            case 'Digital Marketing':
                programPrefix = 'DM';
                break;
            case 'Entrepreneurship':
                programPrefix = 'EN';
                break;
            default:
                return res.status(400).json({ message: 'Invalid program selected' });
        }

        const kywId = await generateUniqueKYWId(programPrefix);
        // console.log('Generated KYW ID:', kywId);

        const surveyResponse = new SurveyResponse({
            userInfo,
            mcqData: selectedMcqData,
            currentWorth,
            afterWorth,
            selectedProgram,
            kywId,
        });
        await surveyResponse.save();
        res.status(200).json({ message: 'User information saved successfully', kywId });

        // Read the HTML template
        const emailTemplatePath = path.join(__dirname, '..', 'templates', 'emailTemp.html'); // Adjusted path
        fs.readFile(emailTemplatePath, 'utf8', (err, htmlContent) => {
            if (err) {
                console.error('Error reading email template:', err);
                return res.status(500).json({ message: 'Error sending email', error: err.message });
            }

            // Replace the placeholder with the actual KYW ID
            let personalizedHtml = htmlContent.replace('{{kywId}}', kywId);
            personalizedHtml = personalizedHtml.replace('{{userName}}', userInfo.name);

            // Send email with the KYW ID
            const mailOptions = {
                from: 'support@invicious.in',
                to: userInfo.email,
                subject: 'Your KYW ID for Bootcamp.180 Enrollment',
                html: personalizedHtml,
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending email:', error);
                    return res.status(500).json({ message: 'Error sending email', error: error.message });
                } else {
                    // console.log('Email sent');
                    // Send response after email is sent
                    return res.status(200).json({ message: 'User information saved successfully' });
                }
            });
        });

    } catch (error) {
        console.error('Error saving survey response:', error);
        return res.status(500).json({ message: 'Error saving survey response', error: error.message });
    }
};




// Add selected program
exports.addProgram = async (req, res) => {
    const { email, selectedProgram } = req.body;

    if (!email || !selectedProgram) {
        return res.status(400).json({ message: 'Email and selected program are required.' });
    }

    try {
        const existingUser = await SurveyResponse.findOne({ 'userInfo.email': email });

        if (!existingUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        existingUser.selectedProgram = selectedProgram;
        await existingUser.save();

        return res.status(200).json({ message: 'Selected program updated successfully', data: existingUser });
    } catch (error) {
        console.error('Error updating selected program:', error);
        res.status(500).json({ message: 'Error updating selected program' });
    }
};

// Add date and time
exports.addDateTime = async (req, res) => {
    const { email, date, time, paymentmethod, amount } = req.body;

    if (!email || !date || !time || !paymentmethod || !amount) {
        return res.status(400).json({ message: 'Datas required.' });
    }

    try {
        const existingUser = await SurveyResponse.findOne({ 'userInfo.email': email });

        if (!existingUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Check if the user has already booked any slot
        if (existingUser.bookedSlots.length > 0) {
            return res.status(400).json({ message: 'You can only book one slot overall.' });
        }

        // Check if the specific time slot is already booked
        const timeExists = existingUser.bookedSlots.some(slot => slot.date === date && slot.time === time);
        if (timeExists) {
            return res.status(400).json({ message: 'This date and time slot is already booked.' });
        }

        existingUser.bookedSlots.push({ date, time });
        existingUser.paymentmethod = paymentmethod;
        existingUser.amount = amount / 100;
        await existingUser.save();

        // Send an invoice email
        const emailTemplatePath = path.join(__dirname, '..', 'templates', 'emailTempInvoice.html');



        const actualTotal = existingUser.amount
        const gstRate = 0.18;
        const baseAmount = (actualTotal / (1 + gstRate)).toFixed(2);
        const gstAmount = (actualTotal - baseAmount).toFixed(2);

        fs.readFile(emailTemplatePath, 'utf8', (err, htmlContent) => {
            if (err) {
                console.error('Error reading email template:', err);
                return res.status(500).json({ message: 'Error sending email', error: err.message });
            }

            // Replace placeholders with actual data
            let personalizedHtml = htmlContent
                .replace('{{kywId}}', existingUser.kywId)
                .replace('{{userName}}', existingUser.userInfo.name)
                .replace('{{selectedProgram}}', existingUser.selectedProgram)
                .replace('{{selectedPrograms}}', existingUser.selectedProgram)
                .replace('{{bookedSlotDetails}}', `${date} at ${time}`)

                .replace('{{total}}', actualTotal)
                .replace('{{gst}}', gstAmount)
                .replace('{{base}}', baseAmount);


            // Send email
            const mailOptions = {
                from: 'support@invicious.in',
                to: email,
                subject: 'Invoice & Slot Confirmation for Your Training Program Enrollment',
                html: personalizedHtml,
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    // console.error('Error sending email:', error);
                    return res.status(500).json({ message: 'Error sending email', error: error.message });
                } else {
                    // console.log('Email sent: ', info.response);
                    return res.status(200).json({ success: true, message: 'Date and time added and email sent successfully' });
                }
            });
        });

    } catch (error) {
        console.error('Error adding date and time:', error);
        res.status(500).json({ message: 'Error adding date and time' });
    }
};




// Get booked slots
exports.getBookedSlots = async (req, res) => {
    const { date } = req.query;

    try {
        const bookedSlots = await SurveyResponse.find({ 'bookedSlots.date': date });
        const slots = bookedSlots.flatMap(response =>
            response.bookedSlots.filter(slot => slot.date === date)
        );

        res.status(200).json({ bookedSlots: slots });
    } catch (error) {
        console.error('Error fetching booked slots:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


// Check if a slot is booked
exports.checkSlotBooked = async (req, res) => {
    const { date, time, program } = req.query;

    if (!date || !time || !program) {
        return res.status(400).json({ message: 'Date, time, and program are required.' });
    }

    try {
        const bookedSlots = await SurveyResponse.find({
            'bookedSlots.date': date,
            'bookedSlots.time': time,
            'bookedSlots.program': program,
        });

        if (bookedSlots.length > 0) {
            return res.status(200).json({ isBooked: true });
        } else {
            return res.status(200).json({ isBooked: false });
        }
    } catch (error) {
        console.error('Error checking booked slot:', error);
        res.status(500).json({ message: 'Error checking booked slot' });
    }
};



// verify id

exports.verifyId = async (req, res) => {
    const { kywId } = req.body;

    try {
        const surveyResponse = await SurveyResponse.findOne({ kywId: { $regex: new RegExp(`^${kywId}$`, 'i') } });

        if (!surveyResponse) {
            return res.status(404).json({ valid: false, message: 'The KYW ID you entered is invalid. Please try again.' });
        }

        if (surveyResponse.bookedSlots.length > 0) {
            return res.status(400).json({
                valid: false,
                message: 'Slot already booked. You can only book once.'
            });
        }

        return res.status(200).json({
            valid: true,
            email: surveyResponse.userInfo.email,
            message: 'Valid KYW ID'
        });

    } catch (error) {
        console.error('Error verifying KYW ID:', error);
        return res.status(500).json({ valid: false, message: 'Error verifying KYW ID', error: error.message });
    }
};

exports.fetchBookedSlotsUI = async (req, res) => {
    try {
        // Find users enrolled in "Design & Creation" program
        const users = await SurveyResponse.find({ selectedProgram: 'Design & Creation' });

        // Flatten and collect booked slots
        const bookedSlots = users.flatMap(user => user.bookedSlots.map(slot => ({
            date: slot.date,
            time: slot.time
        })));

        // Respond with booked slots
        return res.status(200).json(bookedSlots);

    } catch (error) {
        console.error('Error fetching booked slots:', error);
        return res.status(500).json({ message: 'Error fetching booked slots', error: error.message });
    }
};



exports.fetchBookedSlotsWD = async (req, res) => {
    try {
        // Find users enrolled in "Design & Creation" program
        const users = await SurveyResponse.find({ selectedProgram: 'Web Development' });

        // Flatten and collect booked slots
        const bookedSlots = users.flatMap(user => user.bookedSlots);

        // Respond with booked slots
        return res.status(200).json(bookedSlots);

    } catch (error) {
        console.error('Error fetching booked slots:', error);
        return res.status(500).json({ message: 'Error fetching booked slots', error: error.message });
    }
};


exports.fetchBookedSlotsDM = async (req, res) => {
    try {
        // Find users enrolled in "Design & Creation" program
        const users = await SurveyResponse.find({ selectedProgram: 'Digital Marketing' });

        // Flatten and collect booked slots
        const bookedSlots = users.flatMap(user => user.bookedSlots);

        // Respond with booked slots
        return res.status(200).json(bookedSlots);

    } catch (error) {
        console.error('Error fetching booked slots:', error);
        return res.status(500).json({ message: 'Error fetching booked slots', error: error.message });
    }
};


// exports.submitPayment = async (req, res) => {
//     const { kywId, payment } = req.body;

//     try {
//         // Verify if KYW ID exists
//         const surveyResponse = await SurveyResponse.findOne({ kywId: kywId });

//         if (!surveyResponse) {
//             return res.status(404).json({ success: false, message: 'KYW ID not found' });
//         }

//         // Update the payment status
//         surveyResponse.payment = payment;

//         // Save the updated record
//         await surveyResponse.save();

//         return res.status(200).json({ success: true, message: 'Payment status updated successfully' });


//         // Read the HTML template
//         const emailTemplatePath = path.join(__dirname, '..', 'templates', 'emailTemp.html'); // Adjusted path
//         fs.readFile(emailTemplatePath, 'utf8', (err, htmlContent) => {
//             if (err) {
//                 console.error('Error reading email template:', err);
//                 return res.status(500).json({ message: 'Error sending email', error: err.message });
//             }

//             // Replace the placeholder with the actual KYW ID
//             let personalizedHtml = htmlContent.replace('{{kywId}}', kywId);
//             personalizedHtml = personalizedHtml.replace('{{userName}}', userInfo.name);

//             // Send email with the KYW ID
//             const mailOptions = {
//                 from: 'support@invicious.in',
//                 to: userInfo.email,
//                 subject: 'Your KYW ID for Bootcamp.180 Enrollment',
//                 html: personalizedHtml,
//             };

//             transporter.sendMail(mailOptions, (error, info) => {
//                 if (error) {
//                     console.error('Error sending email:', error);
//                     return res.status(500).json({ message: 'Error sending email', error: error.message });
//                 } else {
//                     console.log('Email sent: ' + info.response);
//                     // Send response after email is sent
//                     return res.status(200).json({ message: 'User information saved successfully', kywId });
//                 }
//             });
//         });

//     } catch (error) {
//         console.error('Error updating payment status:', error);
//         return res.status(500).json({ success: false, message: 'Error processing payment', error: error.message });
//     }
// };

exports.submitPayment = async (req, res) => {
    const { kywId, payment } = req.body;

    try {
        // Verify if KYW ID exists
        const surveyResponse = await SurveyResponse.findOne({ kywId: kywId });

        if (!surveyResponse) {
            return res.status(404).json({ success: false, message: 'KYW ID not found' });
        }

        // Update the payment status
        surveyResponse.payment = payment;

        // Save the updated record
        await surveyResponse.save();


        const { userInfo, selectedProgram, bookedSlots } = surveyResponse;

        if (!userInfo) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Read the HTML template


    } catch (error) {
        console.error('Error updating payment status:', error);
        return res.status(500).json({ success: false, message: 'Error processing payment', error: error.message });
    }
};
