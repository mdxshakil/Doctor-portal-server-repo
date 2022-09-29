const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
const { request } = require('express');


// middlwire
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome doctors portal servers!')
})
const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized Access' })
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next();
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.duzu3ld.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctor_Portal').collection('services');
        const bookingCollection = client.db('doctor_Portal').collection('bookings');
        const usersCollection = client.db('doctor_Portal').collection('users');
        const doctorsCollection = client.db('doctor_Portal').collection('doctors');

        // verify admin or not using custom middle wire
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await usersCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next()
            }
            else {
                res.status(403).send({ message: 'Forbidden' })
            }
        }
        //put the user info on db
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1d'
            })
            res.send({ result, token });
        })
        //make user admin
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email; //jake admin banate chai tar email
            const requester = req.decoded.email; //je admin banabe tar email
            const requesterAccount = await usersCollection.findOne({ email: requester });

            const filter = { email: email };
            const updatedDoc = {
                $set: { role: 'admin' },
            };
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);

        })
        //check user admin or not
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === "admin";
            res.send({ admin: isAdmin });
        })
        //get all users
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await usersCollection.find().toArray()
            res.send(users);
        })
        //load all service
        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query).project({ name: 1 });
            const services = await cursor.toArray();
            res.send(services);
        })

        //add a new booking
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient };
            const exist = await bookingCollection.findOne(query);
            if (exist) {
                return res.send({ success: false, booking: exist })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        })

        // this is not the proper way to query. Use aggregate lookup, pipeline, match, group instead
        app.get('/available', async (req, res) => {
            const date = req.query.date;
            // 1: get all the services
            const services = await serviceCollection.find().toArray();
            // 2: get the booking of that day
            const query = { date: date }
            const bookings = await bookingCollection.find(query).toArray();
            // 3: for each service
            services.forEach(service => {
                // 4: find the bookings of that service
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                // 5: select slots for the service bookings
                const bookedSlots = serviceBookings.map(book => book.slot);
                // 6: select those slots that are not in bookedSlots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                service.slots = available;
            })
            res.send(services);
        })

        //booking dashboard
        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient }
                const bookings = await bookingCollection.find(query).toArray();
                res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

        })
        //add doctor to db
        app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor);
            res.send(result);
        })

        //get all the doctors
        app.get('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctors = await doctorsCollection.find().toArray();
            res.send(doctors);
        })
        //delete doctor
        app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await doctorsCollection.deleteOne(filter);
            res.send(result);
        })

    }
    finally {
        //   await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Doctor portal listening on port ${port}`)
})