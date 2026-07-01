require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hospital';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection & In-Memory Fallback State
let useMongo = true;
let isConnected = false;

const memoryDb = {
  patients: [
    { _id: 'p1', name: 'John Doe', age: 45, disease: 'Hypertension', registrationDate: new Date('2026-06-28') },
    { _id: 'p2', name: 'Jane Smith', age: 30, disease: 'Flu', registrationDate: new Date('2026-06-29') },
    { _id: 'p3', name: 'Robert Lee', age: 58, disease: 'Diabetes', registrationDate: new Date('2026-06-30') }
  ],
  appointments: [
    { _id: 'a1', patientName: 'John Doe', doctorName: 'Dr. Gregory House', date: new Date('2026-07-02T10:00:00'), status: 'Scheduled' },
    { _id: 'a2', patientName: 'Jane Smith', doctorName: 'Dr. Meredith Grey', date: new Date('2026-07-03T14:30:00'), status: 'Scheduled' }
  ],
  bills: [
    { _id: 'b1', patientName: 'John Doe', amount: 250, status: 'Paid', date: new Date('2026-06-28') },
    { _id: 'b2', patientName: 'Jane Smith', amount: 120, status: 'Unpaid', date: new Date('2026-06-29') },
    { _id: 'b3', patientName: 'Robert Lee', amount: 450, status: 'Unpaid', date: new Date('2026-06-30') }
  ]
};

const connectDB = async () => {
  if (isConnected) {
    return;
  }
  try {
    // serverSelectionTimeoutMS fails fast (5s) instead of buffering endlessly (10s+)
    const db = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = db.connections[0].readyState === 1;
    useMongo = true;
    console.log('Successfully connected to MongoDB.');
  } catch (err) {
    console.warn('\n==================================================================');
    console.warn('[WARNING] MongoDB connection failed:', err.message);
    console.warn('The server will start using a temporary in-memory database fallback.');
    console.warn('Note: Data will not persist after the server restarts.');
    console.warn('==================================================================\n');
    useMongo = false;
  }
};

// Start connection asynchronously for local dev
connectDB();

// Middleware: Ensure DB connection is active before processing any API request (Crucial for Vercel Serverless)
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api')) {
    await connectDB();
  }
  next();
});

// Schemas & Models
const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, required: true },
  disease: { type: String, required: true },
  registrationDate: { type: Date, default: Date.now }
});

const appointmentSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  doctorName: { type: String, required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['Scheduled', 'Completed', 'Cancelled'], default: 'Scheduled' }
});

const billSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['Paid', 'Unpaid'], default: 'Unpaid' },
  date: { type: Date, default: Date.now }
});

const Patient = mongoose.model('Patient', patientSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);
const Bill = mongoose.model('Bill', billSchema);

// ==================== API ROUTES ====================

// --- Patients Routes ---
app.get('/api/patients', async (req, res) => {
  try {
    if (useMongo) {
      const patients = await Patient.find().sort({ registrationDate: -1 });
      res.json(patients);
    } else {
      // Sort memoryDb copy by date descending
      const sorted = [...memoryDb.patients].sort((a, b) => new Date(b.registrationDate) - new Date(a.registrationDate));
      res.json(sorted);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patients', async (req, res) => {
  try {
    const { name, age, disease } = req.body;
    if (!name || !age || !disease) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (useMongo) {
      const newPatient = new Patient({ name, age: Number(age), disease });
      await newPatient.save();
      res.status(201).json(newPatient);
    } else {
      const newPatient = {
        _id: 'p_' + Math.random().toString(36).substr(2, 9),
        name,
        age: Number(age),
        disease,
        registrationDate: new Date()
      };
      memoryDb.patients.push(newPatient);
      res.status(201).json(newPatient);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Appointments Routes ---
app.get('/api/appointments', async (req, res) => {
  try {
    if (useMongo) {
      const appointments = await Appointment.find().sort({ date: 1 });
      res.json(appointments);
    } else {
      const sorted = [...memoryDb.appointments].sort((a, b) => new Date(a.date) - new Date(b.date));
      res.json(sorted);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const { patientName, doctorName, date } = req.body;
    if (!patientName || !doctorName || !date) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (useMongo) {
      const newAppointment = new Appointment({ patientName, doctorName, date: new Date(date) });
      await newAppointment.save();
      res.status(201).json(newAppointment);
    } else {
      const newAppointment = {
        _id: 'a_' + Math.random().toString(36).substr(2, 9),
        patientName,
        doctorName,
        date: new Date(date),
        status: 'Scheduled'
      };
      memoryDb.appointments.push(newAppointment);
      res.status(201).json(newAppointment);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Billing Routes ---
app.get('/api/billing', async (req, res) => {
  try {
    if (useMongo) {
      const bills = await Bill.find().sort({ date: -1 });
      res.json(bills);
    } else {
      const sorted = [...memoryDb.bills].sort((a, b) => new Date(b.date) - new Date(a.date));
      res.json(sorted);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/billing', async (req, res) => {
  try {
    const { patientName, amount } = req.body;
    if (!patientName || !amount) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (useMongo) {
      const newBill = new Bill({ patientName, amount: Number(amount) });
      await newBill.save();
      res.status(201).json(newBill);
    } else {
      const newBill = {
        _id: 'b_' + Math.random().toString(36).substr(2, 9),
        patientName,
        amount: Number(amount),
        status: 'Unpaid',
        date: new Date()
      };
      memoryDb.bills.push(newBill);
      res.status(201).json(newBill);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/billing/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['Paid', 'Unpaid'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if (useMongo) {
      const updatedBill = await Bill.findByIdAndUpdate(id, { status }, { new: true });
      if (!updatedBill) {
        return res.status(404).json({ error: 'Bill not found' });
      }
      res.json(updatedBill);
    } else {
      const bill = memoryDb.bills.find(b => b._id === id);
      if (!bill) {
        return res.status(404).json({ error: 'Bill not found' });
      }
      bill.status = status;
      res.json(bill);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Dashboard Stats Route ---
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    let stats = {};

    if (useMongo) {
      const totalPatients = await Patient.countDocuments();
      const scheduledAppointments = await Appointment.countDocuments({ status: 'Scheduled' });
      const unpaidBillsObj = await Bill.aggregate([
        { $match: { status: 'Unpaid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const paidBillsObj = await Bill.aggregate([
        { $match: { status: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      const unpaidTotal = unpaidBillsObj[0] ? unpaidBillsObj[0].total : 0;
      const paidTotal = paidBillsObj[0] ? paidBillsObj[0].total : 0;

      // Quick recent logs
      const recentPatients = await Patient.find().sort({ registrationDate: -1 }).limit(3);
      const recentAppointments = await Appointment.find().sort({ date: -1 }).limit(3);
      const recentBills = await Bill.find().sort({ date: -1 }).limit(3);

      stats = {
        totalPatients,
        scheduledAppointments,
        unpaidTotal,
        paidTotal,
        recentPatients,
        recentAppointments,
        recentBills,
        databaseType: 'MongoDB'
      };
    } else {
      const totalPatients = memoryDb.patients.length;
      const scheduledAppointments = memoryDb.appointments.filter(a => a.status === 'Scheduled').length;
      const unpaidTotal = memoryDb.bills.filter(b => b.status === 'Unpaid').reduce((sum, b) => sum + b.amount, 0);
      const paidTotal = memoryDb.bills.filter(b => b.status === 'Paid').reduce((sum, b) => sum + b.amount, 0);

      const recentPatients = [...memoryDb.patients].sort((a, b) => new Date(b.registrationDate) - new Date(a.registrationDate)).slice(0, 3);
      const recentAppointments = [...memoryDb.appointments].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
      const recentBills = [...memoryDb.bills].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);

      stats = {
        totalPatients,
        scheduledAppointments,
        unpaidTotal,
        paidTotal,
        recentPatients,
        recentAppointments,
        recentBills,
        databaseType: 'In-Memory Fallback (Local)'
      };
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Catch-all route to serve the frontend for single-page style navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`\n==================================================================`);
  console.log(`Hospital Management System Backend started successfully on Port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser to view the application.`);
  console.log(`==================================================================\n`);
});
