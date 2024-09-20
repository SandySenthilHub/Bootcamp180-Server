const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const surveyRoutes = require('./routes/surveyRoutes');
const payment = require('./controllers/payment')


const app = express();

app.use(bodyParser.json());
app.use(cors());
app.use(express.json());

const db_connection_string = process.env.DB_CONNECTION_STRING;
// Connect to MongoDB
mongoose.connect(db_connection_string, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 60000
})
    .then(() => {
        console.log('MongoDB connected successfully');
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
    });


app.use('/api', surveyRoutes);
app.use("/api/payment/", payment);



// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
