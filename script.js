const API_KEY = '5787ca83'; // <--- KEEP YOUR KEY HERE
const searchInput = document.getElementById('search-input');
const container = document.getElementById('movie-container');
const loadingTrigger = document.getElementById('loading-trigger');
const favCountSpan = document.getElementById('fav-count');
const scrollTopBtn = document.getElementById('scroll-top-btn');
const suggestionsBox = document.getElementById('suggestions-box'); // <--- NEW

// Modal Elements
const favModal = document.getElementById('fav-modal');
const favBtn = document.getElementById('favorites-btn');
const closeBtn = document.getElementById('close-modal');
const favContainer = document.getElementById('fav-container');

// State
let currentPage = 1;
let currentQuery = '';
let isLoading = false;
let totalResults = 0;
let favorites = JSON.parse(localStorage.getItem('myMovieFavs')) || [];

// --- UTILS ---
function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
}

// --- API HANDLING ---
async function fetchMovies(query, page) {
    if (!query) return;
    
    // Only show main loader if it's the first page (initial search)
    if (page === 1) {
        isLoading = true;
        loadingTrigger.textContent = 'Loading...';
    }

    try {
        // Step 1: Search for List
        const response = await fetch(`https://www.omdbapi.com/?apikey=${API_KEY}&s=${query}&page=${page}&type=movie`);
        const data = await response.json();

        if (data.Response === "True") {
            totalResults = parseInt(data.totalResults);
            
            // NEW: If page 1, update the suggestions dropdown
            if (page === 1) {
                renderSuggestions(data.Search);
            }

            // Step 2: Parallel Fetch for Details
            const detailedMovies = await Promise.all(
                data.Search.map(async (movie) => {
                    const detailResponse = await fetch(`https://www.omdbapi.com/?apikey=${API_KEY}&i=${movie.imdbID}`);
                    return await detailResponse.json();
                })
            );
            
            renderMovies(detailedMovies);
            loadingTrigger.textContent = '';
        } else {
            if (page === 1) {
                container.innerHTML = `<div class="placeholder-text">${data.Error || "No movies found"}</div>`;
                suggestionsBox.classList.add('hidden'); // Hide suggestions if no results
            }
            loadingTrigger.textContent = '';
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        loadingTrigger.textContent = 'Error fetching data.';
    } finally {
        isLoading = false;
    }
}

// --- NEW: SUGGESTION LOGIC ---
function renderSuggestions(movies) {
    // Clear previous suggestions
    suggestionsBox.innerHTML = '';
    
    // Take top 5 results for the dropdown
    const topResults = movies.slice(0, 5);
    
    if (topResults.length > 0) {
        suggestionsBox.classList.remove('hidden');
        
        topResults.forEach(movie => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${movie.Title}</span> <span style="opacity:0.6; font-size:0.8em;">${movie.Year}</span>`;
            
            // Click handling
            li.addEventListener('click', () => {
                searchInput.value = movie.Title; // Fill input
                suggestionsBox.classList.add('hidden'); // Hide list
                
                // Trigger a specific search for this exact movie to clean up grid
                currentQuery = movie.Title;
                currentPage = 1;
                container.innerHTML = '';
                fetchMovies(currentQuery, currentPage);
            });
            
            suggestionsBox.appendChild(li);
        });
    } else {
        suggestionsBox.classList.add('hidden');
    }
}

// Hide suggestions when clicking outside
document.addEventListener('click', (e) => {
    if (!suggestionsBox.contains(e.target) && e.target !== searchInput) {
        suggestionsBox.classList.add('hidden');
    }
});

// --- RENDER FUNCTIONS (Same as before) ---
function createCardHTML(movie, isFav, isRemoveMode = false) {
    const poster = (movie.Poster && movie.Poster !== "N/A") ? movie.Poster : 'https://via.placeholder.com/200x300?text=No+Image';
    const safeTitle = movie.Title.replace(/'/g, "\\'"); 
    const movieData = JSON.stringify({
        imdbID: movie.imdbID,
        Title: safeTitle,
        Year: movie.Year,
        Poster: poster,
        imdbRating: movie.imdbRating,
        Type: movie.Type,
        Plot: movie.Plot ? movie.Plot.replace(/"/g, "'") : "No description"
    }).replace(/"/g, "&quot;");

    const shortPlot = movie.Plot && movie.Plot !== "N/A" 
        ? (movie.Plot.length > 120 ? movie.Plot.substring(0, 120) + '...' : movie.Plot)
        : "No description available.";

    return `
        <div class="movie-card">
            <div style="position:relative;">
                <img src="${poster}" alt="${movie.Title}" onerror="this.onerror=null;this.src='https://via.placeholder.com/200x300?text=Image+Not+Found';">
                <div class="card-overlay">
                    <p class="plot-text">${shortPlot}</p>
                </div>
            </div>
            <div class="info">
                <h3>${movie.Title}</h3>
                <div class="meta">
                    <span>${movie.Year}</span>
                    <span class="type-badge">${movie.Type || "Movie"}</span>
                    <span class="rating">⭐ ${movie.imdbRating || "N/A"}</span>
                </div>
                <button class="fav-btn ${isFav ? 'active' : ''} ${isRemoveMode ? 'remove-mode' : ''}" 
                        onclick="toggleFavorite(${movieData})">
                    ${isRemoveMode ? 'Remove' : (isFav ? 'Saved' : 'Add to Favorites')}
                </button>
            </div>
        </div>
    `;
}

function renderMovies(movies) {
    movies.forEach(movie => {
        if (!document.querySelector(`button[onclick*='${movie.imdbID}']`)) {
            const isFav = favorites.some(fav => fav.imdbID === movie.imdbID);
            container.innerHTML += createCardHTML(movie, isFav);
        }
    });
    updateFavCount();
}

// --- SEARCH LOGIC ---
const handleSearch = debounce((e) => {
    const query = e.target.value.trim();
    if (query.length === 0) {
        container.innerHTML = '<div class="placeholder-text">Type a movie name to start searching...</div>';
        suggestionsBox.classList.add('hidden'); // Hide suggestions
        currentQuery = '';
        return; 
    }
    if (query.length < 2) return; 

    currentQuery = query;
    currentPage = 1;
    container.innerHTML = ''; 
    fetchMovies(currentQuery, currentPage);
}, 500);

searchInput.addEventListener('input', handleSearch);

// --- FAVORITES & MODAL LOGIC (Same as before) ---
window.toggleFavorite = (movieObj) => {
    const index = favorites.findIndex(m => m.imdbID === movieObj.imdbID);
    if (index === -1) favorites.push(movieObj);
    else favorites.splice(index, 1);
    localStorage.setItem('myMovieFavs', JSON.stringify(favorites));
    updateFavCount();
    if(!favModal.classList.contains('hidden')) renderFavoritesModal();
    const btns = document.querySelectorAll(`button[onclick*='${movieObj.imdbID}']`);
    btns.forEach(btn => {
         btn.classList.toggle('active');
         btn.textContent = btn.classList.contains('active') ? 'Saved' : 'Add to Favorites';
    });
};

function updateFavCount() { favCountSpan.textContent = favorites.length; }

function renderFavoritesModal() {
    favContainer.innerHTML = '';
    if (favorites.length === 0) {
        favContainer.innerHTML = '<div class="placeholder-text">No favorites yet!</div>';
        return;
    }
    favorites.forEach(movie => { favContainer.innerHTML += createCardHTML(movie, true, true); });
}

favBtn.addEventListener('click', () => {
    renderFavoritesModal();
    favModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
});
closeBtn.addEventListener('click', () => {
    favModal.classList.add('hidden');
    document.body.style.overflow = 'auto';
});
favModal.addEventListener('click', (e) => {
    if (e.target === favModal) {
        favModal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
});

const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLoading && currentQuery) {
        if ((currentPage * 10) < totalResults) {
            currentPage++;
            fetchMovies(currentQuery, currentPage);
        }
    }
}, { threshold: 1.0 });
observer.observe(loadingTrigger);

window.addEventListener('scroll', () => {
    if (window.scrollY > 300) scrollTopBtn.classList.remove('hidden');
    else scrollTopBtn.classList.add('hidden');
});
scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

updateFavCount();
