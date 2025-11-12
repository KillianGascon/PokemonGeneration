// App.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { indexedDbService } from './services/indexedDbService';
import { pokemonApiService } from './services/pokemonApiService';
import { computePrice } from './services/pricingService';
import { Pokemon, TokenBalance, AppMessage, PokemonStatus, PokemonRarity } from './types';
import Button from './components/Button';
import Modal from './components/Modal';
import { Coins, Sparkles, RefreshCw, XCircle, Gem, Loader2, Search, ChevronDown } from 'lucide-react';

const GENERATION_COST = 10;
const BATCH_SIZE = 4;
const BATCH_GENERATION_COST = BATCH_SIZE * GENERATION_COST;

const App: React.FC = () => {
  const [pokemons, setPokemons] = useState<Pokemon[]>([]);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGeneratingPokemon, setIsGeneratingPokemon] = useState<boolean>(false);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState<boolean>(false);
  const [message, setMessage] = useState<AppMessage | null>(null);

  // Pokédex search and filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [rarityFilter, setRarityFilter] = useState<PokemonRarity | 'ALL'>('ALL');

  // Resell Modal states
  const [isResellModalOpen, setIsResellModalOpen] = useState<boolean>(false);
  const [resellModalTitle, setResellModalTitle] = useState<string>('');
  const [resellModalContent, setResellModalContent] = useState<React.ReactNode>(null);
  const [resellModalOnConfirm, setResellModalOnConfirm] = useState<(() => void) | undefined>(undefined);
  const [isResellModalConfirmLoading, setIsResellModalConfirmLoading] = useState<boolean>(false);

  // Batch Generation Modal states
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [batchResult, setBatchResult] = useState<Pokemon[] | null>(null);

  const fetchAppData = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedPokemons = await indexedDbService.getPokemons();
      
      // Data migration: calculate price for Pokémon without one
      const pokemonsToUpdate: Pokemon[] = [];
      const migratedPokemons = fetchedPokemons.map(p => {
        if (p.price === undefined) {
          const newPrice = computePrice(p.rarity);
          const updatedPokemon = { ...p, price: newPrice };
          pokemonsToUpdate.push(updatedPokemon);
          return updatedPokemon;
        }
        return p;
      });

      if (pokemonsToUpdate.length > 0) {
        console.log(`Migrating ${pokemonsToUpdate.length} Pokémon to include prices.`);
        await Promise.all(pokemonsToUpdate.map(p => indexedDbService.updatePokemon(p)));
      }

      setPokemons(migratedPokemons.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()));
      
      const balance = await indexedDbService.getTokenBalance();
      setTokenBalance(balance.amount);
      setMessage(null);
    } catch (error) {
      console.error("Failed to fetch app data:", error);
      showMessage('error', 'Failed to load app data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppData();
  }, [fetchAppData]);

  const showMessage = useCallback((type: 'success' | 'error' | 'warning', text: string) => {
    setMessage({ type, text });
    const timer = setTimeout(() => {
      setMessage(null);
    }, 5000); // Message disappears after 5 seconds
    return () => clearTimeout(timer);
  }, []);

  const handleGeneratePokemon = async () => {
    if (tokenBalance < GENERATION_COST) {
      showMessage('warning', `You need ${GENERATION_COST} tokens to generate a Pokémon. Current balance: ${tokenBalance}.`);
      return;
    }

    setIsGeneratingPokemon(true);
    let originalTokenBalance = tokenBalance;
    
    try {
      const newBalanceAfterDeduction = originalTokenBalance - GENERATION_COST;
      setTokenBalance(newBalanceAfterDeduction);
      await indexedDbService.updateTokenBalance(newBalanceAfterDeduction);
      
      const newPokemon = await pokemonApiService.generatePokemon();
      await indexedDbService.addPokemon(newPokemon);
      setPokemons((prevPokemons) => [newPokemon, ...prevPokemons].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()));
      showMessage('success', `Awesome! You generated a new Pokémon: ${newPokemon.name} (${newPokemon.rarity})!`);
      
    } catch (error) {
      console.error("Error generating Pokémon:", error);
      setTokenBalance(originalTokenBalance);
      await indexedDbService.updateTokenBalance(originalTokenBalance);
      showMessage('error', `Failed to generate Pokémon: ${error instanceof Error ? error.message : String(error)}. Tokens refunded.`);
    } finally {
      setIsGeneratingPokemon(false);
    }
  };

  const handleGenerateBatch = async () => {
    if (tokenBalance < BATCH_GENERATION_COST) {
      showMessage('warning', `You need ${BATCH_GENERATION_COST} tokens to generate a squad. Current balance: ${tokenBalance}.`);
      return;
    }

    setIsGeneratingBatch(true);
    try {
      const newPokemons = await pokemonApiService.generatePokemonBatch(BATCH_SIZE);

      // Persist to DB first
      await Promise.all(newPokemons.map(p => indexedDbService.addPokemon(p)));
      const newBalance = tokenBalance - BATCH_GENERATION_COST;
      await indexedDbService.updateTokenBalance(newBalance);

      // Then update state
      setTokenBalance(newBalance);
      setPokemons((prevPokemons) => [...newPokemons, ...prevPokemons].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()));
      setBatchResult(newPokemons);
      setIsBatchModalOpen(true);
      showMessage('success', `Awesome! You generated a new squad of ${BATCH_SIZE} Pokémon!`);

    } catch (error) {
      console.error("Error generating Pokémon batch:", error);
      showMessage('error', `Failed to generate squad: ${error instanceof Error ? error.message : String(error)}. No tokens were deducted.`);
    } finally {
      setIsGeneratingBatch(false);
    }
  };


  const handleResellConfirmation = (pokemon: Pokemon) => {
    const resellValue = pokemon.price ?? computePrice(pokemon.rarity); // Fallback for safety
    setResellModalTitle('Resell Pokémon');
    setResellModalContent(
      <p className="text-gray-700">
        Are you sure you want to resell <span className="font-semibold text-indigo-700">{pokemon.name}</span>?
        You will receive <span className="font-bold text-green-600">{resellValue} tokens</span> back. This action cannot be undone.
      </p>
    );
    setResellModalOnConfirm(() => async () => {
      setIsResellModalConfirmLoading(true);
      try {
        const updatedPokemon = { ...pokemon, status: PokemonStatus.RESOLD };
        await indexedDbService.updatePokemon(updatedPokemon);
        
        const newBalance = tokenBalance + resellValue;
        await indexedDbService.updateTokenBalance(newBalance);

        setPokemons((prevPokemons) =>
          prevPokemons.map((p) => (p.id === updatedPokemon.id ? updatedPokemon : p)),
        );
        setTokenBalance(newBalance);
        
        showMessage('success', `${pokemon.name} resold successfully! You gained ${resellValue} tokens.`);
      } catch (error) {
        console.error("Error reselling Pokémon:", error);
        showMessage('error', `Failed to resell Pokémon: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsResellModalConfirmLoading(false);
        closeResellModal();
      }
    });
    setIsResellModalOpen(true);
  };

  const closeResellModal = () => {
    setIsResellModalOpen(false);
    setResellModalTitle('');
    setResellModalContent(null);
    setResellModalOnConfirm(undefined);
    setIsResellModalConfirmLoading(false);
  };

  const closeBatchModal = () => {
    setIsBatchModalOpen(false);
    setBatchResult(null);
  };

  const getRarityColor = useCallback((rarity: PokemonRarity) => {
    switch (rarity) {
      case PokemonRarity.F: return 'bg-gray-200 text-gray-800';
      case PokemonRarity.E: return 'bg-gray-300 text-gray-900';
      case PokemonRarity.D: return 'bg-blue-100 text-blue-800';
      case PokemonRarity.C: return 'bg-green-100 text-green-800';
      case PokemonRarity.B: return 'bg-purple-100 text-purple-800';
      case PokemonRarity.A: return 'bg-yellow-100 text-yellow-800';
      case PokemonRarity.S: return 'bg-orange-100 text-orange-800';
      case PokemonRarity.S_PLUS: return 'bg-red-100 text-red-800 font-bold';
      default: return 'bg-gray-100 text-gray-700';
    }
  }, []);

  const filteredPokemons = useMemo(() => {
    return pokemons
      .filter(pokemon => {
        if (rarityFilter === 'ALL') return true;
        return pokemon.rarity === rarityFilter;
      })
      .filter(pokemon => {
        if (!searchTerm) return true;
        return pokemon.name.toLowerCase().includes(searchTerm.toLowerCase());
      });
  }, [pokemons, searchTerm, rarityFilter]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-4xl sm:text-5xl font-extrabold text-center mb-10 text-indigo-800 drop-shadow-md">
        Pokémon Generator Lab
      </h1>

      {message && (
        <div
          className={`p-4 mb-6 rounded-lg shadow-md flex items-center justify-between transition-opacity duration-300 ${
            message.type === 'success' ? 'bg-green-100 text-green-800' :
            message.type === 'error' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }`}
          role="alert"
        >
          <p className="font-medium">{message.text}</p>
          <Button variant="ghost" size="sm" onClick={() => setMessage(null)}>
            <XCircle className="h-5 w-5" />
          </Button>
        </div>
      )}

      <div className="bg-yellow-50 p-4 sm:p-6 rounded-xl shadow-md mb-8 flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-yellow-800 flex items-center gap-3">
          <Gem className="h-7 w-7 text-yellow-600" />
          Your Tokens:
        </h2>
        <span className="text-3xl sm:text-4xl font-extrabold text-yellow-900 leading-none">
          {tokenBalance}
        </span>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg mb-10 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-gray-900">
          Generate New Pokémon
        </h2>
        <p className="text-gray-600 mb-6">
          Unleash the power of AI to create unique Pokémon!
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            onClick={handleGeneratePokemon}
            variant="secondary"
            size="lg"
            className="w-full sm:w-auto flex items-center justify-center gap-2"
            disabled={isGeneratingPokemon || isGeneratingBatch || isLoading || tokenBalance < GENERATION_COST}
          >
            {isGeneratingPokemon ? (
              <span className="flex items-center">
                <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                Generating...
              </span>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate Single ({GENERATION_COST} Tokens)
              </>
            )}
          </Button>
          <Button
            onClick={handleGenerateBatch}
            variant="primary"
            size="lg"
            className="w-full sm:w-auto flex items-center justify-center gap-2"
            disabled={isGeneratingPokemon || isGeneratingBatch || isLoading || tokenBalance < BATCH_GENERATION_COST}
          >
            {isGeneratingBatch ? (
              <span className="flex items-center">
                <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                Generating Squad...
              </span>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate Squad ({BATCH_GENERATION_COST} Tokens)
              </>
            )}
          </Button>
        </div>
        <p className="text-gray-500 mt-4 text-sm">Feeling lucky? Generate four Pokémon at once with the squad generator!</p>
      </div>

      <h2 className="text-3xl sm:text-4xl font-bold mb-8 text-gray-900 text-center">My Pokédex</h2>
      
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition"
            aria-label="Search Pokédex by name"
          />
        </div>
        <div className="relative">
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value as PokemonRarity | 'ALL')}
            className="w-full md:w-auto appearance-none pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white transition"
            aria-label="Filter Pokédex by rarity"
          >
            <option value="ALL">All Rarities</option>
            {Object.values(PokemonRarity).map(rarity => (
              <option key={rarity} value={rarity}>{rarity}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="animate-spin h-10 w-10 text-indigo-600" />
          <p className="ml-4 text-lg text-gray-600">Loading your Pokédex...</p>
        </div>
      ) : pokemons.length === 0 ? (
        <p className="text-center text-gray-500 text-xl py-12 bg-white rounded-xl shadow-md">
          Your Pokédex is empty. Start generating Pokémon to build your collection!
        </p>
      ) : filteredPokemons.length === 0 ? (
        <p className="text-center text-gray-500 text-xl py-12 bg-white rounded-xl shadow-md">
          No Pokémon match your search criteria. Try adjusting your filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPokemons.map((pokemon) => (
            <div key={pokemon.id} className="bg-white p-6 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-200 flex flex-col">
              <div className="flex-grow">
                <div className="relative w-full h-48 mb-4 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                  <img
                    src={`data:image/png;base64,${pokemon.imageBase64}`}
                    alt={pokemon.name}
                    className="object-contain w-full h-full"
                    loading="lazy"
                  />
                  {pokemon.status === PokemonStatus.RESOLD && (
                    <div className="absolute inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center text-white text-lg font-bold">
                      RESOLD
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 flex items-center justify-between">
                  <span>{pokemon.name}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${getRarityColor(pokemon.rarity)}`}>
                    {pokemon.rarity}
                  </span>
                </h3>
                <div className="text-gray-700 font-medium flex items-center mb-2">
                  <Coins className="h-5 w-5 mr-2 text-yellow-500" />
                  <span>Resell Value: </span>
                  <span className="font-bold ml-1">{pokemon.price ?? computePrice(pokemon.rarity)} Tokens</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
                <span>Generated: {new Date(pokemon.generatedAt).toLocaleDateString()}</span>
                {pokemon.status === PokemonStatus.OWNED ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleResellConfirmation(pokemon)}
                    aria-label={`Resell ${pokemon.name} for ${pokemon.price ?? 0} tokens`}
                  >
                    <Coins className="h-4 w-4 mr-1" /> Resell (+{pokemon.price ?? 0})
                  </Button>
                ) : (
                  <span className="text-red-500 flex items-center gap-1">
                    <RefreshCw className="h-4 w-4" /> Resold
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isResellModalOpen}
        onClose={closeResellModal}
        title={resellModalTitle}
        onConfirm={resellModalOnConfirm}
        confirmButtonText="Resell"
        cancelButtonText="Cancel"
        confirmButtonVariant="danger"
        isLoading={isResellModalConfirmLoading}
      >
        {resellModalContent}
      </Modal>

      <Modal
        isOpen={isBatchModalOpen}
        onClose={closeBatchModal}
        title="Your New Squad!"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label="Newly generated Pokémon squad">
          {batchResult?.map((pokemon) => (
            <div 
              key={pokemon.id} 
              className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center transform hover:scale-105 transition-transform duration-200"
              aria-label={`${pokemon.name}, Rarity: ${pokemon.rarity}`}
            >
              <div className="relative w-full h-32 mb-3 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                <img
                  src={`data:image/png;base64,${pokemon.imageBase64}`}
                  alt={pokemon.name}
                  className="object-contain w-full h-full"
                  loading="lazy"
                />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 truncate">{pokemon.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${getRarityColor(pokemon.rarity)}`}>
                Rarity: {pokemon.rarity}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Button onClick={closeBatchModal} variant="primary">
            Awesome! View in Collection
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default App;
