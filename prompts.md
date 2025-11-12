prompt 1 : Génération de batchs

Create an extension of the Pokémon Generator website that allows users to generate multiple Pokémon at once (batch of 4) instead of just one.

Main Objective

Enable users to generate four random Pokémon simultaneously, displayed in a visually appealing grid layout, while keeping the single Pokémon generation option.

Functional Requirements

New “Generate 4 Pokémon” button beside the existing “Generate 1 Pokémon” button.

When clicked, the app should:

Fetch 4 random Pokémon from the API.

Display them in a responsive grid (2x2 on desktop, 1x4 stacked on mobile).

Include loading animations for each card individually while waiting for data.

Each Pokémon card must display:

Name

Official artwork

Type(s)

Stats (HP, Attack, Defense, etc.)

Short description

Design

Layout:

Centered 2×2 grid for 4 Pokémon.

Add a small hover animation (e.g., scale or glow).

Color palette and typography:

Keep same theme (Pokéball-inspired palette, Poppins or Press Start 2P).

Responsive behavior:

Desktop → 2x2

Tablet → 2x2 or 1x4 depending on width

Mobile → 1x4 vertical list

Technical Details

Use the existing fetchPokemon() function and adapt it into a fetchBatch(count: number) function.

Use Promise.all() to parallelize 4 API requests:

const fetchBatch = async (count = 4) => {
  const ids = Array.from({ length: count }, () => Math.floor(Math.random() * 898) + 1);
  const results = await Promise.all(ids.map(id => fetchPokemon(id)));
  return results;
};


Use React state to store an array of Pokémon:

const [batch, setBatch] = useState<Pokemon[]>([]);


Animate cards using Framer Motion (staggered fade/slide-in).

Keep both “Generate One” and “Generate Four” buttons visible.

Accessibility & UX

Each card should have aria-label describing the Pokémon (name + type).

Include aria-busy while loading.

Keyboard navigation must let users focus each card.

Possible Tagline

“Feeling lucky? Generate four Pokémon at once!”

prompt 2 : Amélioration du pokedex

Enhance the Pokémon Generator website by adding a Pokédex feature that automatically stores every Pokémon generated (either individually or in batches of 4). This Pokédex should persist across sessions and allow users to browse, search, and filter their collected Pokémon.

Main Objective

Transform the app from a simple random Pokémon generator into a collectible experience, where users can view and manage all previously generated Pokémon.

Functional Requirements

Automatic Storage:

Every generated Pokémon (via single or batch generation) is automatically added to the Pokédex.

Duplicates are allowed but should be identifiable (optional toggle to “hide duplicates”).

Pokédex Page / Section:

Accessible via a new “My Pokédex” button or tab in the navigation bar.

Displays all stored Pokémon in a responsive grid (3x3 or 4x4 on desktop, 2x2 on mobile).

Pokémon Card Display:

Thumbnail (official image)

Name

Type(s)

Optionally, show a “View Details” modal (stats, description, etc.)

Search & Filter:

Search by name

Filter by type (Fire, Water, Grass, etc.)

Filter by generation (optional enhancement)

Data Persistence

Use LocalStorage or IndexedDB to persist the Pokédex locally:

const saveToPokedex = (pokemon: Pokemon) => {
  const existing = JSON.parse(localStorage.getItem('pokedex') || '[]');
  const updated = [...existing, pokemon];
  localStorage.setItem('pokedex', JSON.stringify(updated));
};


Load saved Pokémon on page load:

useEffect(() => {
  const saved = JSON.parse(localStorage.getItem('pokedex') || '[]');
  setPokedex(saved);
}, []);

UI/UX Design

Layout:

Dedicated Pokédex view (/pokedex route or tab).

Sticky header with search + filter controls.

Scrollable grid with consistent card size.

Empty State:

Message: “Your Pokédex is empty! Generate your first Pokémon to start collecting.”

Include a CTA button “Generate Pokémon”.

Interactions:

Hover animation on cards (slight scale or glow).

Delete button (optional) to remove entries.

Responsive:

Desktop → multi-column grid

Mobile → 1-column scroll list

Technical Details

State Management:

pokedex stored in React state + persisted in localStorage.

Update Pokédex after each generation event.

Routing:

Use React Router (/ for Generator, /pokedex for collection).

Components:

PokedexCard.tsx

PokedexGrid.tsx

SearchBar.tsx

FilterBar.tsx

Accessibility

Each Pokémon card must have alt text and aria-label with name and type.

Search and filter inputs should be keyboard and screen-reader friendly.

Color contrast must comply with WCAG 2.1 AA.

Optional Enhancements

Add a “Favorite” toggle (store in localStorage as well).

Enable export/import of Pokédex data (JSON format).

Add statistics dashboard: total collected, type distribution, etc.

Example Tagline

“Build your personal Pokédex — catch and keep every Pokémon you generate!”


prompt 3 : prix des pokémons en fonction de la rareté

Goal
Add a dynamic pricing system that automatically calculates and displays a Pokémon’s selling price based on its rarity, with clear logic, consistent UI feedback, and persistent data storage.

Functional Requirements


Every Pokémon has a rarity field with one of the following values:
common, uncommon, rare, epic, legendary, mythic.


Each Pokémon’s price is calculated automatically based on rarity multipliers.


Prices update across the app (generator and Pokédex).


A currency system is configurable (default ₽ or PokeCoins).


Prices persist in local storage or database and are recalculated when pricing rules change (via version control).



Pricing Formula
price = round(baseValue * rarityMultiplier * (1 + statBonus) * (1 + tagBonus))



Stat Bonus (optional): +0–0.25 depending on normalized base stat total (e.g., BST / 680).


Tag Bonus (optional): +0.10 if shiny === true, +0.05 if favorite === true.


RarityMultipliercommon1.0uncommon1.3rare1.8epic2.6legendary4.0mythic5.5


Bounds: minPrice = 100, maxPrice = 999999


Rounding: nearest multiple of 10 for cleaner display



UI / UX


Add a rarity badge (color-coded) to each Pokémon card.


Display the price below the name, with a tooltip explaining “calculated from rarity.”


Allow filtering Pokédex entries by rarity and price range.


Add settings options for:


Currency type


Enable/disable bonuses (shiny/favorite)


Toggle rounding behavior





Accessibility


Price label must include aria-label describing rarity and currency.


Rarity badges should meet WCAG 2.1 AA contrast.


Tooltips must be keyboard and screen-reader accessible.



Persistence & Versioning


Store a pricingRules.version value.


When the version changes, recalculate all Pokémon prices on load.


Each Pokédex entry stores { id, rarity, baseValue, price, computedAt, rulesVersion }.



Backend / API (optional)


If using a backend, create an endpoint GET /v1/pricing-rules to fetch rules dynamically.


Use CORS headers and ETag-based caching.



Testing (Definition of Done)


Verify expected prices for all rarity levels.


Test shiny/favorite bonuses.


Check rounding, clamping, and version-based recalculation.


Maintain Lighthouse Accessibility score ≥ 90.



Example (TypeScript Implementation)
type Rarity = 'common'|'uncommon'|'rare'|'epic'|'legendary'|'mythic';

const RARITY_MULTIPLIER: Record<Rarity, number> = {
  common: 1.0,
  uncommon: 1.3,
  rare: 1.8,
  epic: 2.6,
  legendary: 4.0,
  mythic: 5.5,
};

interface PricingRules {
  version: string;
  minPrice: number;
  maxPrice: number;
  roundTo: number;
  enableStatBonus: boolean;
  enableTagBonus: boolean;
}

export const PRICING_RULES: PricingRules = {
  version: 'v1.0.0',
  minPrice: 100,
  maxPrice: 999999,
  roundTo: 10,
  enableStatBonus: true,
  enableTagBonus: true,
};

export function computePrice(
  baseValue: number,
  rarity: Rarity,
  opts?: { totalStats?: number; shiny?: boolean; favorite?: boolean }
): number {
  const rules = PRICING_RULES;
  const mult = RARITY_MULTIPLIER[rarity];

  const statBonus = rules.enableStatBonus
    ? Math.min(Math.max(((opts?.totalStats ?? 0) / 680), 0), 1) * 0.25
    : 0;

  const tagBonus = rules.enableTagBonus
    ? (opts?.shiny ? 0.10 : 0) + (opts?.favorite ? 0.05 : 0)
    : 0;

  let price = baseValue * mult * (1 + statBonus) * (1 + tagBonus);

  price = Math.min(Math.max(price, rules.minPrice), rules.maxPrice);
  const r = rules.roundTo;
  price = Math.round(price / r) * r;

  return price;
}


Integration Notes


Add price to the Pokémon data model.


Compute it during generation and persist it in the Pokédex.


Trigger global recalculation if pricing rule version changes.



Deliverables


Configurable pricing rules.


Visible rarity and price in UI.


Persisted data with recalculation on version change.


Fully tested price computation logic.


Short documentation section in README: “Dynamic Pricing System.”

