import physicsData from './data/physics-videos.json';
import chemistryData from './data/chemistry-videos.json';
import mathematicsData from './data/mathematics-videos.json';

const physics = [
  'Basic Mathematics','Vectors','Units, Dimensions and Measurement','Motion in a Straight Line','Motion in a Plane','Laws of Motion','Friction','Work, Energy and Power','Circular Motion','Centre of Mass, Momentum and Collision','Rotational Motion – Part 1','Rotational Motion – Part 2','Gravitation','Properties of Solids','Fluids – Part 1','Fluids – Part 2','Thermal Properties of Matter','Heat Transfer and Kinetic Theory of Gases','Thermodynamics','Simple Harmonic Motion','Wave Motion','Sound and Doppler Effect','Electric Charges and Fields','Electric Potential, Dipole and Conductor','Capacitors','Current Electricity','Electrical Instruments and RC Circuits','Moving Charges and Magnetism','Magnetism and Matter','Electromagnetic Induction','Inductors, LR and LC Circuits','Alternating Current','Electromagnetic Waves and Communication','Ray Optics','Optical Instruments','Wave Optics','Modern Physics – Part 1','Modern Physics – Part 2','Modern Physics – Part 3','Modern Physics – Part 4','Semiconductors – Part 1','Semiconductors – Part 2','Communication Systems'
];
const chemistry = [
  'Mole Concept','Atomic Structure','Periodic Table','Chemical Bonding – Part 1','Chemical Bonding – Part 2','Redox Reaction','Hydrogen','Nomenclature','General Organic Chemistry','Isomerism','S-Block Elements','Hydrocarbons','Aromatic Hydrocarbons','Gaseous State','Thermodynamics','Chemical Equilibrium','Ionic Equilibrium','Solid State','P-Block Elements – Part 1','Solutions','Electrochemistry','Metallurgy','Chemical Kinetics','Surface Chemistry','Haloalkanes and Haloarenes','Alcohols, Phenols and Ethers','P-Block Elements – Part 2','Aldehydes, Ketones and Carboxylic Acids','Amines','Practical Organic Chemistry','P-Block Elements – Part 3','Biomolecules','D-Block and F-Block Elements','Coordination Compounds','Salt Analysis','Polymers','Chemistry in Everyday Life','Environmental Chemistry'
];
const mathematics = [
  'Basic Mathematics','Sets and Relations','Functions','Quadratic Equations','Sequence and Series','Trigonometric Functions','Trigonometric Equations','Solutions of Triangles','Complex Numbers','Permutations and Combinations','Binomial Theorem','Straight Lines','Circles','Parabola','Ellipse','Hyperbola','Relations and Functions','Inverse Trigonometric Functions','Limits','Continuity','Differentiability','Methods of Differentiation','Applications of Derivatives','Indefinite Integration','Definite Integration','Applications of Integrals','Differential Equations','Determinants','Matrices','Vectors','Three-Dimensional Geometry','Probability','Statistics','Mathematical Reasoning','Linear Programming'
];

function enrich(names, data, subject, key) {
  const videos = Array.isArray(data.videos) ? data.videos : [];
  return names.map((name, index) => ({
    id: `${key}-${String(index + 1).padStart(2, '0')}`,
    key: `${key}:${index}`,
    subject,
    subjectKey: key,
    index,
    number: index + 1,
    name,
    url: videos[index]?.url || videos[index]?.short_url || data.playlist_url,
    videoId: videos[index]?.video_id || '',
  }));
}

export const subjects = [
  { key: 'P', name: 'Physics', short: 'PHY', color: 'blue', chapters: enrich(physics, physicsData, 'Physics', 'P') },
  { key: 'C', name: 'Chemistry', short: 'CHEM', color: 'violet', chapters: enrich(chemistry, chemistryData, 'Chemistry', 'C') },
  { key: 'M', name: 'Mathematics', short: 'MATH', color: 'amber', chapters: enrich(mathematics, mathematicsData, 'Mathematics', 'M') },
];
export const allChapters = subjects.flatMap(s => s.chapters);
export const totalChapters = allChapters.length;
export const subjectByKey = Object.fromEntries(subjects.map(s => [s.key, s]));
