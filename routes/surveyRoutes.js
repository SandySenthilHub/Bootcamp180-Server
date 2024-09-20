const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyResponseController');

// Define routes for survey response
router.post('/submit', surveyController.submitSurvey);
router.post('/add-program', surveyController.addProgram);
router.post('/add-date-time', surveyController.addDateTime);
router.get('/get-booked-slots', surveyController.getBookedSlots);
router.get('/check-slot-booked', surveyController.checkSlotBooked);
router.post('/verify-id', surveyController.verifyId);
router.get('/booked-slots/design-creation', surveyController.fetchBookedSlotsUI);
router.get('/booked-slots/development', surveyController.fetchBookedSlotsWD);
router.get('/booked-slots/digital-marketing', surveyController.fetchBookedSlotsDM);
router.post('/submit-payment', surveyController.submitPayment);




module.exports = router;
