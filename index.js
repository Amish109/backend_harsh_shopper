


const port = 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { type } = require("os");
const { log } = require("console");
const Razorpay = require("razorpay");
const crypto = require("crypto");
// const path = require("path");
const fs = require("fs");
// const bodyParser = require("body-parser");




app.use(express.json());
app.use(cors());
// app.use(bodyParser.json());

const razorpay = new Razorpay({
    key_id: "rzp_test_W1njiux8uI153d",
    key_secret: "o1mq3yguXlLvoq27zJYErMjx"
})




    




// Database connection with MongoDb
mongoose.connect("mongodb+srv://harshdevadkar:harshdevadkar7781@cluster0.dwz1l.mongodb.net/shopper-website")

// API CREATION


// for payment
app.post("/api/orders/create-order", async (req, res)=>{
    try {
        const { amount, currency } = req.body; // Amount in smallest currency unit (paise)
      console.log("amount in backend",amount);
        const options = {
          amount: amount * 100, // Convert amount to paisa
          currency: currency || "INR",
          receipt: `order_rcptid_${Date.now()}`,
        };
        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });
      } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error });
      }
});


app.post("/api/orders/verify-payment", async (req, res)=>{
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
          req.body;
        console.log("razorpay_order_id, razorpay_payment_id, razorpay_signature",razorpay_order_id, razorpay_payment_id, razorpay_signature);
        const generated_signature = crypto
          .createHmac("sha256", "o1mq3yguXlLvoq27zJYErMjx")
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest("hex");
        console.log("generated_signature",generated_signature)
        if (generated_signature === razorpay_signature) {
          res.json({ success: true, message: "Payment verified successfully" });
        } else {
          res.status(400).json({ success: false, message: "Invalid signature" });
        }
      } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error });
      }
})


app.get("/",(req,res)=>{
    res.send("Express app is running")
})

// Image Storage Engine
const uploadPath = '/tmp/upload';

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
    destination:function (req, file, cb) {
     cb(null, uploadPath);
    },
    filename:(req,file,cb)=>{
     return cb(null,`${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload = multer({storage:storage})

// Creating Upload Endpoint for images
app.use('/images',express.static('temp/upload'))

app.post("/upload",upload.single('product'),(req,res)=>{
    console.log("req",req)
  try {
    res.json({
        success:1,
        image_url:`http://localhost:${port}/images/${req.file.filename}`
    })
  } catch (error) {
   res.send(error) 
  }
})



// Schema for creating products 


const Product = mongoose.model("Product",{
    id:{
        type: Number,
        required: true,
    },
    name:{
        type: String,
        required: true,
    },
    image:{
        type: String,
        required: true,
    },
    category:{
        type: String,
        required: true,
    },
    new_price:{
        type: Number,
        required: true,
    },
    old_price:{
        type: Number,
        required: true,
    },
    date:{
        type: Date,
        default: Date.now,
    },
    available:{
        type: Boolean,
        default: true,
    },

})

app.post('/addproduct', async (req,res)=>{

    let products = await Product.find({});

    let id;
    if(products.length>0)
    {
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id+1;
    }
    else{
        id=1; 
    }
    const product = new Product({
        id:id,
        name:req.body.name,
        image:req.body.image,
        category:req.body.category,
        new_price:req.body.new_price,
        old_price:req.body.old_price,
    });
    console.log(product);
    await product.save();
    console.log("Saved");
    res.json({
        success: true,
        name: req.body.name,
    })
})


// Creating Api For Deleting Products

app.post('/removeproduct', async (req,res)=>{
    await Product.findOneAndDelete({id:req.body.id});
    console.log("Removed");
    res.json({
        success:true,
        name:req.body.name
    })
})

// Creating Api For Getting All Products

app.get('/allproducts', async (req,res)=>{
    let products = await Product.find({});
    console.log("All Products Fetched");
    res.send(products);
})

// schema creating for User Model
const Users = mongoose.model('Users', {
    name: {
        type: String,
    },
    email: {
        type: String,
        unique: true,
    },
    password: {
        type: String,
    },
    cartData: {
        type: Object,
    },
    role: {
        type: String,
        enum: ['admin', 'user'], // Only allows 'admin' or 'user'
        default: 'user', // Default role is 'user'
    },
    date: {
        type: Date,
        default: Date.now,
    }
});


// Creating Endpoint for registering User 



app.post('/signup',async (req,res)=>{
    let check = await Users.findOne({email:req.body.email});
    if(check){
        return res.status(400).json({success:false,errors:"existing user found with same email address"})
    }
    let cart = {};
    for (let i = 0; i < 300; i++) {
       cart[i]=0;
        
    }
    const user = new Users({
        name:req.body.username,
        email:req.body.email,
        password:req.body.password,
        cartData:cart,
    })

    await user.save();

    const data = {
        user:{
            id:user.id
        }
    }

    const token = jwt.sign(data,'secret_ecom')
    res.json({success:true,token})
})


// creating endpoint for user login

app.post('/login',async (req,res)=>{
    let user = await Users.findOne({email:req.body.email});

    if(user){
        const passCompare = req.body.password === user.password;
        if (passCompare) {
            const data = {
                user:{
                    id:user.id
                }
            }

            const token = jwt.sign(data,'secret_ecom');
            res.json({success:true,token});
        }
        else{
            res.json({success:false,errors:"Wrong Password"})
        }
    }
    else{
        res.json({success:false,errors:"Wrong Email Id"})
    }
})

// creating end point for new collection data

app.get('/newcollections', async(req,res)=>{
 let products = await Product.find({});
 let newcollection = products.slice(1).slice(-8);
 console.log("NewCollection Fetched");
 res.send(newcollection);
})

// creating end point for popular in women section


app.get('/popularinwomen',async(req,res)=>{
    let products = await Product.find({category:"women"});
    let popular_in_women = products.slice(0,4);
    console.log("Popular in women fetched");
    res.send(popular_in_women);
})


// creating middleware to fetch user


const fetchUser = async (req,res,next)=>{
    const token = req.header('auth-token');
    if (!token) {
        res.status(401).send({errors:"Please authenticate using valid token"})
    }
    else{
        try {
            const data = jwt.verify(token,'secret_ecom');
            req.user = data.user;
            next();
        } catch (error) {
            res.status(401).send({errors:"please authenticate using a valid token"})
        }
    }
}

// creating end points for adding products in cartData

    app.post('/addtocart',fetchUser,async(req,res)=>{
        console.log("Added", req.body.itemId);

        
        let userData = await Users.findOne({_id:req.user.id});

        userData.cartData[req.body.itemId] +=1;
        await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
        res.send("Added")
    })


    // creating end point to remove product from cartData

    app.post('/removefromcart', fetchUser, async(req,res)=>{
        console.log("removed", req.body.itemId);
        let userData = await Users.findOne({_id:req.user.id});
        if ( userData.cartData[req.body.itemId]>0)
        userData.cartData[req.body.itemId] -=1;
        await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
        res.send("removed")
    })


    // creatin end point to get cartData

    app.post('/getcart',fetchUser,async(req,res)=>{
        console.log("GetCart");
        let userData = await Users.findOne({_id:req.user.id});
        res.json(userData.cartData);
    })


app.listen(port,(error)=>{
    if (!error) {
        console.log("Server running on port " + port)
    }
    else{
        console.log("Error : "+error);
        
    }
})