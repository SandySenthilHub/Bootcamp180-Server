const router = require("express").Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");

const key_id = process.env.KEY_ID;
const key_secret = process.env.KEY_SECRET;

// Check if environment variables are set
if (!key_id || !key_secret) {
    throw new Error("Environment variables KEY_ID and KEY_SECRET must be set");
}

router.post("/orders", async (req, res) => {
    try {
        const instance = new Razorpay({
            key_id: key_id,
            key_secret: key_secret,
        });

        const options = {
            amount: req.body.amount * 100,
            currency: "INR",
            receipt: crypto.randomBytes(10).toString("hex"),
        };

        instance.orders.create(options, (error, order) => {
            if (error) {
                console.log(error);
                return res.status(500).json({ message: "Something Went Wrong!" });
            }
            res.status(200).json({ data: order });
        });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error!" });
        console.log(error);
    }
});

router.post("/verify", async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const sign = razorpay_order_id + "|" + razorpay_payment_id;

        const instance = new Razorpay({
            key_id: key_id,
            key_secret: key_secret,
        });

        const expectedSign = crypto
            .createHmac("sha256", key_secret)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({ message: "Invalid signature sent!" });
        }

        // Fetch payment details from Razorpay to confirm payment status
        const paymentDetails = await instance.payments.fetch(razorpay_payment_id);

        if (paymentDetails.status === "captured") {
            return res.status(200).json({ message: "Payment verified successfully", success: true });
        } else {
            return res.status(400).json({ message: "Payment failed", success: false });
        }
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error!" });
        console.log(error);
    }
});

module.exports = router;