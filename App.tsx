// App.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { indexedDbService } from './services/indexedDbService';
import { pokemonApiService } from './services/pokemonApiService';
import { computePrice } from './services/pricingService';
import { Pokemon, TokenBalance, AppMessage, PokemonStatus, PokemonRarity } from './types';
import Button from './components/Button';
import Modal from './components/Modal';
import Cutscene from './components/Cutscene';
import { Coins, Sparkles, RefreshCw, XCircle, Gem, Loader2, Search, ChevronDown, Check, ShoppingCart } from 'lucide-react';

const GENERATION_COST = 10;
const BATCH_SIZE = 4;
const BATCH_GENERATION_COST = BATCH_SIZE * GENERATION_COST;
const FUSION_COST = 20;
const UNDO_DURATION_SECONDS = 10;

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

  // Sell Modal states (for single sell)
  const [isSellModalOpen, setIsSellModalOpen] = useState<boolean>(false);
  const [sellModalPokemon, setSellModalPokemon] = useState<Pokemon | null>(null);
  const [isSellModalConfirmLoading, setIsSellModalConfirmLoading] = useState<boolean>(false);

  // Batch Generation Modal states
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [batchResult, setBatchResult] = useState<Pokemon[] | null>(null);
  
  // Bulk Sell states
  const [isBulkSellMode, setIsBulkSellMode] = useState<boolean>(false);
  const [bulkSelectedPokemonIds, setBulkSelectedPokemonIds] = useState<string[]>([]);
  const [isBulkSellModalOpen, setIsBulkSellModalOpen] = useState<boolean>(false);
  const [isBulkSelling, setIsBulkSelling] = useState<boolean>(false);

  // Undo Sale states
  const [lastSaleBackup, setLastSaleBackup] = useState<{ pokemons: Pokemon[]; totalValue: number } | null>(null);
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [undoTimeLeft, setUndoTimeLeft] = useState(0);

  // Cutscene state
  const [cutscenePokemon, setCutscenePokemon] = useState<Pokemon | null>(null);

  const fetchAppData = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedPokemons = await indexedDbService.getPokemons();
      
      // --- Start of Fusion Removal Migration Logic ---
      const anyFetchedPokemons = fetchedPokemons as any[];
      const fusedPokemonIds = anyFetchedPokemons.filter(p => p.isFused).map(p => p.id);
      let pokemonsToKeep = anyFetchedPokemons.filter(p => !p.isFused);
      
      const parentPokemonsToClean = pokemonsToKeep
          .filter((p: any) => p.usedInFusion)
          .map((p: any) => {
              const { usedInFusion, parentIds, isFused, ...rest } = p; // Remove all fusion-related properties
              return rest as Pokemon;
          });

      if (fusedPokemonIds.length > 0) {
          console.log(`Migration: Removing ${fusedPokemonIds.length} fused Pokémon.`);
          await indexedDbService.deletePokemons(fusedPokemonIds);
      }

      if (parentPokemonsToClean.length > 0) {
          console.log(`Migration: Cleaning up ${parentPokemonsToClean.length} parent Pokémon.`);
          await Promise.all(parentPokemonsToClean.map(p => indexedDbService.updatePokemon(p)));
          
          // Update the list in memory as well
          const cleanIds = new Set(parentPokemonsToClean.map(p => p.id));
          pokemonsToKeep = pokemonsToKeep.map((p: any) => {
            if (cleanIds.has(p.id)) {
              const { usedInFusion, parentIds, isFused, ...rest } = p;
              return rest;
            }
            return p;
          });
      }
      // --- End of Fusion Removal Migration Logic ---
      
      const pokemonsToUpdateForPrice: Pokemon[] = [];
      const migratedPokemons = pokemonsToKeep.map((p: any) => {
        if (p.price === undefined) {
          const newPrice = computePrice(p.rarity);
          const updatedPokemon = { ...p, price: newPrice };
          pokemonsToUpdateForPrice.push(updatedPokemon);
          return updatedPokemon;
        }
        return p as Pokemon;
      });

      if (pokemonsToUpdateForPrice.length > 0) {
        console.log(`Migrating ${pokemonsToUpdateForPrice.length} Pokémon to include prices.`);
        await Promise.all(pokemonsToUpdateForPrice.map(p => indexedDbService.updatePokemon(p)));
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

    // Preload cutscene audio assets to prevent delay on first trigger
    new Audio('/kanec-348765.mp3');
    new Audio('/challenger-348770.mp3');
  }, [fetchAppData]);
  
  useEffect(() => {
    if (undoTimeLeft > 0) {
      const interval = setInterval(() => {
        setUndoTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [undoTimeLeft]);

  const showMessage = useCallback((type: 'success' | 'error' | 'warning', text: string) => {
    setMessage({ type, text });
    const timer = setTimeout(() => {
      setMessage(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const rarityOrder = useMemo(() => Object.values(PokemonRarity), []);

  const triggerCutsceneIfNeeded = (pokemon: Pokemon) => {
    if (pokemon.rarity === PokemonRarity.S || pokemon.rarity === PokemonRarity.S_PLUS) {
      setCutscenePokemon(pokemon);
    }
  };
  
  const handleCutsceneEnd = useCallback(() => {
    setCutscenePokemon(null);
  }, []);

  const handleGeneratePokemon = async () => {
    if (tokenBalance < GENERATION_COST) {
      showMessage('warning', `You need ${GENERATION_COST} tokens to generate a Pokémon.`);
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
      setPokemons((prev) => [newPokemon, ...prev].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()));
      showMessage('success', `Awesome! You generated a new Pokémon: ${newPokemon.name} (${newPokemon.rarity})!`);
      triggerCutsceneIfNeeded(newPokemon);
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
      showMessage('warning', `You need ${BATCH_GENERATION_COST} tokens for a squad.`);
      return;
    }
    setIsGeneratingBatch(true);
    try {
      const newPokemons = await pokemonApiService.generatePokemonBatch(BATCH_SIZE);
      await Promise.all(newPokemons.map(p => indexedDbService.addPokemon(p)));
      const newBalance = tokenBalance - BATCH_GENERATION_COST;
      await indexedDbService.updateTokenBalance(newBalance);
      setTokenBalance(newBalance);
      setPokemons((prev) => [...newPokemons, ...prev].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()));
      setBatchResult(newPokemons);
      setIsBatchModalOpen(true);
      showMessage('success', `Awesome! You generated a new squad of ${BATCH_SIZE} Pokémon!`);

      const bestPokemonInBatch = newPokemons.reduce((best, current) => {
        if (!best) return current;
        const bestIndex = rarityOrder.indexOf(best.rarity);
        const currentIndex = rarityOrder.indexOf(current.rarity);
        return currentIndex > bestIndex ? current : best;
      }, null as Pokemon | null);

      if (bestPokemonInBatch) {
        triggerCutsceneIfNeeded(bestPokemonInBatch);
      }
    } catch (error) {
      console.error("Error generating Pokémon batch:", error);
      showMessage('error', `Failed to generate squad: ${error instanceof Error ? error.message : String(error)}. No tokens were deducted.`);
    } finally {
      setIsGeneratingBatch(false);
    }
  };
  
  const filteredPokemons = useMemo(() => {
    return pokemons
      .filter(pokemon => rarityFilter === 'ALL' || pokemon.rarity === rarityFilter)
      .filter(pokemon => !searchTerm || pokemon.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [pokemons, searchTerm, rarityFilter]);

  // --- Unified Sell & Undo Logic ---
  const handleSellPokemons = async (pokemonsToSell: Pokemon[]) => {
    if (pokemonsToSell.length === 0) return;

    const totalValue = pokemonsToSell.reduce((sum, p) => sum + (p.price ?? 0), 0);
    const idsToSell = pokemonsToSell.map(p => p.id);

    // Create backup for potential undo
    if (undoTimer) clearTimeout(undoTimer);
    setLastSaleBackup({ pokemons: pokemonsToSell, totalValue });
    setUndoTimeLeft(UNDO_DURATION_SECONDS);

    try {
      // Perform deletion and update balance
      await indexedDbService.deletePokemons(idsToSell);
      const newBalance = tokenBalance + totalValue;
      await indexedDbService.updateTokenBalance(newBalance);

      // Update state
      setPokemons(prev => prev.filter(p => !idsToSell.includes(p.id)));
      setTokenBalance(newBalance);
    } catch (error) {
      console.error("Error selling Pokémon:", error);
      showMessage('error', `Failed to sell Pokémon: ${error instanceof Error ? error.message : String(error)}`);
      setLastSaleBackup(null); // Clear backup on failure
    }

    // Set a timer to clear the backup, finalizing the sale
    const newTimer = setTimeout(() => {
      setLastSaleBackup(null);
      showMessage('success', `Sale of ${pokemonsToSell.length} Pokémon finalized.`);
    }, UNDO_DURATION_SECONDS * 1000);
    setUndoTimer(newTimer);
  };

  const handleUndoSale = async () => {
    if (!lastSaleBackup) return;

    if (undoTimer) clearTimeout(undoTimer);
    setUndoTimer(null);

    try {
      await indexedDbService.addPokemons(lastSaleBackup.pokemons);
      const newBalance = tokenBalance - lastSaleBackup.totalValue;
      await indexedDbService.updateTokenBalance(newBalance);

      setPokemons(prev => [...prev, ...lastSaleBackup.pokemons].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()));
      setTokenBalance(newBalance);
      
      showMessage('success', 'Sale undone successfully!');
    } catch (error) {
      console.error("Error undoing sale:", error);
      showMessage('error', `Failed to undo sale: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLastSaleBackup(null);
    }
  };

  const handleSellConfirmation = (pokemon: Pokemon) => {
    setSellModalPokemon(pokemon);
    setIsSellModalOpen(true);
  };

  const handleConfirmSingleSell = async () => {
    if (!sellModalPokemon) return;
    setIsSellModalConfirmLoading(true);
    await handleSellPokemons([sellModalPokemon]);
    setIsSellModalConfirmLoading(false);
    setIsSellModalOpen(false);
    setSellModalPokemon(null);
  };
  
  // --- Bulk Sell Logic ---
  const bulkSellSelection = useMemo(() => {
    return pokemons.filter(p => bulkSelectedPokemonIds.includes(p.id));
  }, [bulkSelectedPokemonIds, pokemons]);

  const bulkSellTotalValue = useMemo(() => {
    return bulkSellSelection.reduce((total, p) => total + (p.price ?? 0), 0);
  }, [bulkSellSelection]);

  const toggleBulkSellMode = () => {
    setIsBulkSellMode(prev => !prev);
    setBulkSelectedPokemonIds([]); // Clear bulk sell selection
  };

  const handleBulkSelectPokemon = (pokemonId: string) => {
    setBulkSelectedPokemonIds(prev =>
      prev.includes(pokemonId)
        ? prev.filter(id => id !== pokemonId)
        : [...prev, pokemonId]
    );
  };
  
  const handleSelectAllVisible = () => {
    const sellableIds = filteredPokemons.map(p => p.id);
    setBulkSelectedPokemonIds(sellableIds);
  };
  
  const handleDeselectAll = () => {
    setBulkSelectedPokemonIds([]);
  };

  const handleConfirmBulkSell = async () => {
    if (bulkSellSelection.length === 0) return;
    setIsBulkSelling(true);
    await handleSellPokemons(bulkSellSelection);
    setIsBulkSellModalOpen(false);
    setBulkSelectedPokemonIds([]);
    setIsBulkSellMode(false);
    setIsBulkSelling(false);
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

  const allButtonsDisabled = isGeneratingPokemon || isGeneratingBatch || isLoading || isBulkSelling || !!cutscenePokemon;
  const isInteracting = allButtonsDisabled || isBulkSellMode;

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
          <Gem className="h-7 w-7 text-yellow-600" /> Your Tokens:
        </h2>
        <span className="text-3xl sm:text-4xl font-extrabold text-yellow-900 leading-none">{tokenBalance}</span>
      </div>

      <div className="max-w-xl mx-auto mb-10">
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg text-center flex flex-col justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-gray-900">Generate Pokémon</h2>
            <p className="text-gray-600 mb-6">Unleash AI to create unique Pokémon!</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-auto">
            <Button onClick={handleGeneratePokemon} variant="secondary" size="lg" className="w-full sm:w-auto" disabled={isInteracting || tokenBalance < GENERATION_COST}>
              {isGeneratingPokemon ? <Loader2 className="animate-spin h-5 w-5" /> : <Sparkles className="h-5 w-5 mr-2" />}
              {isGeneratingPokemon ? 'Generating...' : `Single (${GENERATION_COST})`}
            </Button>
            <Button onClick={handleGenerateBatch} variant="primary" size="lg" className="w-full sm:w-auto" disabled={isInteracting || tokenBalance < BATCH_GENERATION_COST}>
              {isGeneratingBatch ? <Loader2 className="animate-spin h-5 w-5" /> : <Sparkles className="h-5 w-5 mr-2" />}
              {isGeneratingBatch ? 'Generating...' : `Squad (${BATCH_GENERATION_COST})`}
            </Button>
          </div>
        </div>
      </div>

      <h2 className="text-3xl sm:text-4xl font-bold mb-8 text-gray-900 text-center">My Pokédex</h2>
      
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input type="text" placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition" aria-label="Search Pokédex by name" />
        </div>
        <div className="relative">
          <select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value as PokemonRarity | 'ALL')} className="w-full md:w-auto appearance-none pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white transition" aria-label="Filter Pokédex by rarity">
            <option value="ALL">All Rarities</option>
            {Object.values(PokemonRarity).map(rarity => (<option key={rarity} value={rarity}>{rarity}</option>))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        </div>
        <div className="flex gap-2">
            {isBulkSellMode ? (
              <>
                <Button variant="secondary" onClick={handleSelectAllVisible}>Select All Visible</Button>
                <Button variant="secondary" onClick={handleDeselectAll}>Deselect All</Button>
                <Button variant="danger" onClick={toggleBulkSellMode}>Cancel</Button>
              </>
            ) : (
              <Button onClick={toggleBulkSellMode} variant="primary" className="bg-green-600 hover:bg-green-700 focus:ring-green-500" disabled={allButtonsDisabled}>
                <ShoppingCart className="h-5 w-5 mr-2" /> Bulk Sell
              </Button>
            )}
          </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-12"><Loader2 className="animate-spin h-10 w-10 text-indigo-600" /><p className="ml-4 text-lg text-gray-600">Loading your Pokédex...</p></div>
      ) : pokemons.length === 0 ? (
        <p className="text-center text-gray-500 text-xl py-12 bg-white rounded-xl shadow-md">Your Pokédex is empty. Start generating Pokémon!</p>
      ) : filteredPokemons.length === 0 ? (
        <p className="text-center text-gray-500 text-xl py-12 bg-white rounded-xl shadow-md">No Pokémon match your search criteria.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-24">
          {filteredPokemons.map((pokemon) => {
            const isSelectedForBulkSell = bulkSelectedPokemonIds.includes(pokemon.id);
            
            let borderClass = 'border-gray-100';
            if (isBulkSellMode) {
              if (isSelectedForBulkSell) borderClass = 'border-green-500 ring-2 ring-green-500';
            }

            return (
              <div key={pokemon.id}
                className={`relative bg-white p-6 rounded-xl shadow-md border hover:shadow-lg transition-all duration-200 flex flex-col ${allButtonsDisabled ? 'opacity-60' : ''} ${isBulkSellMode ? 'cursor-pointer' : ''} ${borderClass}`}
                onClick={() => !allButtonsDisabled && isBulkSellMode && handleBulkSelectPokemon(pokemon.id)}>
                
                {isBulkSellMode && (
                  <div className={`absolute top-2 left-2 z-10 h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all ${isSelectedForBulkSell ? 'bg-green-500 border-green-600' : 'bg-white border-gray-300'}`}>
                    {isSelectedForBulkSell && <Check className="h-4 w-4 text-white" />}
                  </div>
                )}

                <div className="flex-grow">
                  <div className="relative w-full h-48 mb-4 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                    <img src={`data:image/png;base64,${pokemon.imageBase64}`} alt={pokemon.name} className="object-contain w-full h-full" loading="lazy" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 flex items-center justify-between">
                    <span>{pokemon.name}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getRarityColor(pokemon.rarity)}`}>{pokemon.rarity}</span>
                  </h3>
                  <div className="text-gray-700 font-medium flex items-center mb-2">
                    <Coins className="h-5 w-5 mr-2 text-yellow-500" />
                    <span>Sell Value: </span>
                    <span className="font-bold ml-1">{pokemon.price ?? computePrice(pokemon.rarity)} Tokens</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
                  <span>Generated: {new Date(pokemon.generatedAt).toLocaleDateString()}</span>
                  {!isBulkSellMode && (
                    <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); handleSellConfirmation(pokemon); }} aria-label={`Sell ${pokemon.name}`} disabled={allButtonsDisabled}>
                      <Coins className="h-4 w-4 mr-1" /> Sell (+{pokemon.price ?? 0})
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isBulkSellMode && bulkSelectedPokemonIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-sm shadow-[0_-4px_12px_rgba(0,0,0,0.1)] z-30">
          <div className="container mx-auto flex items-center justify-center">
             <Button size="lg" variant="primary" className="bg-green-600 hover:bg-green-700 focus:ring-green-500 shadow-lg" onClick={() => setIsBulkSellModalOpen(true)}>
              <ShoppingCart className="h-6 w-6 mr-3" />
              Sell {bulkSelectedPokemonIds.length} Pokémon for {bulkSellTotalValue} Tokens
            </Button>
          </div>
        </div>
      )}

      {lastSaleBackup && (
        <div className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white p-4 rounded-lg shadow-lg flex items-center gap-4 animate-fade-in-up" role="status" aria-live="polite">
          <span>Sold {lastSaleBackup.pokemons.length} Pokémon.</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleUndoSale} disabled={undoTimeLeft <= 0}>Undo</Button>
            <span className="text-sm font-mono text-gray-300">({undoTimeLeft}s)</span>
          </div>
        </div>
      )}

      <Modal isOpen={isSellModalOpen} onClose={() => !isSellModalConfirmLoading && setIsSellModalOpen(false)} title="Confirm Sale" onConfirm={handleConfirmSingleSell} confirmButtonText="Sell" cancelButtonText="Cancel" confirmButtonVariant="danger" isLoading={isSellModalConfirmLoading}>
        {sellModalPokemon && (
          <p className="text-gray-700">
            Are you sure you want to sell <span className="font-semibold text-indigo-700">{sellModalPokemon.name}</span>?
            You will receive <span className="font-bold text-green-600">{sellModalPokemon.price ?? 0} tokens</span>. This action can be undone for 10 seconds.
          </p>
        )}
      </Modal>

      <Modal isOpen={isBulkSellModalOpen} onClose={() => !isBulkSelling && setIsBulkSellModalOpen(false)} title={`Confirm Sale (${bulkSellSelection.length} Pokémon)`} onConfirm={handleConfirmBulkSell} confirmButtonText="Confirm Sale" cancelButtonText="Cancel" confirmButtonVariant="danger" isLoading={isBulkSelling}>
        <div className="text-left">
          <p className="mb-4 text-gray-700">Are you sure you want to sell the selected Pokémon? This action can be undone for 10 seconds.</p>
          <div className="max-h-60 overflow-y-auto bg-gray-50 p-3 rounded-lg border">
            <ul className="space-y-2">
              {bulkSellSelection.map(p => (
                <li key={p.id} className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-800">{p.name} <span className="text-gray-500">({p.rarity})</span></span>
                  <span className="font-semibold text-green-600">+{p.price ?? 0} Tokens</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-between items-center mt-4 pt-4 border-t font-bold text-lg">
            <span>Total:</span>
            <span className="text-green-700">{bulkSellTotalValue} Tokens</span>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isBatchModalOpen} onClose={closeBatchModal} title="Your New Squad!">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label="Newly generated Pokémon squad">
          {batchResult?.map((pokemon) => (<div key={pokemon.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center transform hover:scale-105 transition-transform duration-200" aria-label={`${pokemon.name}, Rarity: ${pokemon.rarity}`}>
              <div className="relative w-full h-32 mb-3 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                <img src={`data:image/png;base64,${pokemon.imageBase64}`} alt={pokemon.name} className="object-contain w-full h-full" loading="lazy" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 truncate">{pokemon.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${getRarityColor(pokemon.rarity)}`}>Rarity: {pokemon.rarity}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Button onClick={closeBatchModal} variant="primary">Awesome! View in Collection</Button>
        </div>
      </Modal>
      
      {cutscenePokemon && (
        <Cutscene
          key={cutscenePokemon.id}
          pokemon={cutscenePokemon}
          onEnd={handleCutsceneEnd}
        />
      )}
    </div>
  );
};

export default App;