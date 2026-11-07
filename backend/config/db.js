import mongoose from "mongoose";
import dns from "node:dns";

dns.setServers([
    "1.1.1.1",
    "8.8.8.8"
]);
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log('MongoDB Connected');
        
    } catch (error) {
        console.log('MongoDB Connection Failed',error);
        process.exit(1);
    }
}
export default connectDB;