import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Load firebase config from the project
const firebaseConfigPath = 'C:\\FinalTeamUp\\src\\lib\\firebase.ts';
const configContent = fs.readFileSync(firebaseConfigPath, 'utf8');

// Primitive regex to extract config, or just use the known values if possible
// But it's better to just write a script that uses the known values from the project
// I'll check the lib/firebase.ts file first to get the config
