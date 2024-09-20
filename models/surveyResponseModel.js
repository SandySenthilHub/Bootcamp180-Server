const mongoose = require('mongoose');

// Define Mongoose Schema for survey responses
const surveyResponseSchema = new mongoose.Schema({
    userInfo: {
        name: String,
        email: String,
        phone: String,
    },
    mcqData: Array, 
    currentWorth: Number, 
    afterWorth: Number, 
    selectedProgram: String, 
    kywId:String,
    payment:Boolean,
    submittedAt: { type: Date, default: Date.now },
    bookedSlots: [{ 
        date: String, 
        time: String,
    }],
    paymentmethod:String,
    amount:Number

});

const SurveyResponse = mongoose.model('SurveyResponse', surveyResponseSchema, 'survey_responses');

module.exports = SurveyResponse;
