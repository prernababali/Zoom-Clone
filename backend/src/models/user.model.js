import mongoose, { Schema } from "mongoose";    

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,   // optional: helps avoid case-sensitive duplicates
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    token: {
        type: String,
        default: ""        // ✅ not required, default empty
    }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

export { User };
