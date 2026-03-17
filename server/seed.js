require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const mongoose = require('mongoose');
const Junction = require('./models/Junction');

// List of real-world junctions (Mumbai) before making graph connections
const junctionsData = [
  { name: 'BKC Node', location: { lat: 19.0664, lng: 72.8643 }, laneCount: 4, ref: 'J1' },
  { name: 'Sion Circle', location: { lat: 19.0390, lng: 72.8619 }, laneCount: 4, ref: 'J2' },
  { name: 'Dadar TT Circle', location: { lat: 19.0191, lng: 72.8447 }, laneCount: 4, ref: 'J3' },
  { name: 'Shivaji Park', location: { lat: 19.0279, lng: 72.8358 }, laneCount: 2, ref: 'J4' },
  { name: 'Worli Naka', location: { lat: 18.9986, lng: 72.8174 }, laneCount: 3, ref: 'J5' },
  { name: 'Haji Ali Dargah', location: { lat: 18.9830, lng: 72.8090 }, laneCount: 5, ref: 'J6' },
  { name: 'Mahalaxmi Race Course', location: { lat: 18.9825, lng: 72.8186 }, laneCount: 4, ref: 'J7' },
  { name: 'Byculla Zoo', location: { lat: 18.9790, lng: 72.8340 }, laneCount: 3, ref: 'J8' }
];

const seedDatabase = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from environment variables.");
    }
    
    console.log('🔥 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB.');

    console.log('🧹 Clearing existing junctions...');
    await Junction.deleteMany({});
    console.log('✅ Cleared old data.');

    const createdJunctions = {};

    // 1. Create junction nodes in the database individually to fetch ObjectIds
    console.log('🚦 Creating 8 Mumbai Junctions...');
    for (const j of junctionsData) {
      const newJunction = new Junction({
        name: j.name,
        location: j.location,
        laneCount: j.laneCount,
        neighbours: []
      });
      const savedJunction = await newJunction.save();
      createdJunctions[j.ref] = savedJunction;
    }

    // 2. Define the graph edges between junctions to enable A* Routing later
    // Each pair means they are directly adjacent in the city map
    const graphEdges = [
      ['J1', 'J2'], // BKC -> Sion
      ['J2', 'J3'], // Sion -> Dadar TT
      ['J2', 'J8'], // Sion -> Byculla
      ['J3', 'J4'], // Dadar TT -> Shivaji Park
      ['J3', 'J5'], // Dadar TT -> Worli
      ['J4', 'J5'], // Shivaji -> Worli
      ['J5', 'J6'], // Worli -> Haji Ali
      ['J6', 'J7'], // Haji Ali -> Mahalaxmi
      ['J7', 'J8'], // Mahalaxmi -> Byculla
      ['J7', 'J3'], // Mahalaxmi -> Dadar TT (cross route)
    ];

    console.log('🕸️  Connecting junctions to build routing graph...');
    
    // Process edges in an undirected manner
    for (const edge of graphEdges) {
      const nodeA = createdJunctions[edge[0]];
      const nodeB = createdJunctions[edge[1]];

      // Push A to B's neighbours
      if (!nodeA.neighbours.includes(nodeB._id)) {
        nodeA.neighbours.push(nodeB._id);
      }
      // Push B to A's neighbours
      if (!nodeB.neighbours.includes(nodeA._id)) {
        nodeB.neighbours.push(nodeA._id);
      }

      await nodeA.save();
      await nodeB.save();
    }

    console.log('🏁 Seeding successfully completed! The emergency grid is ready.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
    process.exit(1);
  }
};

seedDatabase();
