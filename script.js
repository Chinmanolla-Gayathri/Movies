const API_KEY = 'e5488a03'; // <--- PASTE KEY HERE AND KEEP QUOTES
const searchInput = document.getElementById('search-input');
const container = document.getElementById('movie-container');
const loadingTrigger = document.getElementById('loading-trigger');
const favCountSpan = document.getElementById('fav-count');

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
    isLoading = true;
    loadingTrigger.textContent = 'Loading...';

    try {
        const response = await fetch(`https://www.omdbapi.com/?apikey=${API_KEY}&s=${query}&page=${page}&type=movie`);
        const data = await response.json();

        if (data.Response === "True") {
            totalResults = parseInt(data.totalResults);
            
            // Parallel Fetching for Details
            const detailedMovies = await Promise.all(
                data.Search.map(async (movie) => {
                    const detailResponse = await fetch(`https://www.omdbapi.com/?apikey=${API_KEY}&i=${movie.imdbID}`);
                    return await detailResponse.json();
                })
            );
            renderMovies(detailedMovies);
            loadingTrigger.textContent = '';
        } else {
            if (page === 1) container.innerHTML = '<div class="placeholder-text">No movies found!</div>';
            loadingTrigger.textContent = '';
        }
    } catch (error) {
        loadingTrigger.textContent = 'Error fetching data.';
    } finally {
        isLoading = false;
    }
}

// --- RENDER FUNCTIONS ---
// This function generates the HTML string for a movie card
function createCardHTML(movie, isFav, isRemoveMode = false) {
    const poster = movie.Poster !== "N/A" ? movie.Poster : 'https://via.placeholder.com/200x300?text=No+Image';
    
    // We escape single quotes in titles to prevent JS errors in the onclick attribute
    const safeTitle = movie.Title.replace(/'/g, "\\'"); 
    const movieData = JSON.stringify({
        imdbID: movie.imdbID,
        Title: safeTitle,
        Year: movie.Year,
        Poster: poster,
        imdbRating: movie.imdbRating,
        Type: movie.Type
    }).replace(/"/g, "&quot;"); // Encode JSON for HTML attribute

    return `
        <div class="movie-card">
            <img src="${poster}" alt="${movie.Title}">
            <div class="info">
                <h3>${movie.Title}</h3>
                <div class="meta">
                    <span>${movie.Year}</span>
                    <span class="rating">⭐ ${movie.imdbRating}</span>
                </div>
                <button class="fav-btn ${isFav ? 'active' : ''} ${isRemoveMode ? 'remove-mode' : ''}" 
                        onclick="toggleFavorite(${movieData})">
                    ${isRemoveMode ? 'Remove X' : (isFav ? 'Saved' : 'Add to Favorites')}
                </button>
            </div>
        </div>
    `;
}

function renderMovies(movies) {
    movies.forEach(movie => {
        const isFav = favorites.some(fav => fav.imdbID === movie.imdbID);
        container.innerHTML += createCardHTML(movie, isFav);
    });
    updateFavCount();
}

// --- FAVORITES LOGIC ---
// We now pass the WHOLE movie object to save all details (rating, etc.)
window.toggleFavorite = (movieObj) => {
    const index = favorites.findIndex(m => m.imdbID === movieObj.imdbID);
    
    if (index === -1) {
        favorites.push(movieObj);
    } else {
        favorites.splice(index, 1);
    }
    
    localStorage.setItem('myMovieFavs', JSON.stringify(favorites));
    updateFavCount();
    
    // If the modal is open, re-render it immediately to show item is gone
    if(!favModal.classList.contains('hidden')) {
        renderFavoritesModal();
    }

    // Update buttons in the main search grid if they exist
    const mainGrid = document.getElementById('movie-container');
    if(mainGrid) {
        // This is a quick UI refresh without refetching API
        const btn = document.querySelector(`button[onclick*='${movieObj.imdbID}']`);
        if(btn) {
             btn.classList.toggle('active');
             btn.textContent = btn.classList.contains('active') ? 'Saved' : 'Add to Favorites';
        }
    }
};

function updateFavCount() {
    favCountSpan.textContent = favorites.length;
}

// --- MODAL LOGIC ---
function renderFavoritesModal() {
    favContainer.innerHTML = '';
    if (favorites.length === 0) {
        favContainer.innerHTML = '<div class="placeholder-text">No favorites yet!</div>';
        return;
    }
    // Reuse the same card HTML logic
    favorites.forEach(movie => {
        // Pass true for isFav, and true for isRemoveMode
        favContainer.innerHTML += createCardHTML(movie, true, true);
    });
}

favBtn.addEventListener('click', () => {
    renderFavoritesModal();
    favModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Stop background scrolling
});

closeBtn.addEventListener('click', () => {
    favModal.classList.add('hidden');
    document.body.style.overflow = 'auto'; // Restore scrolling
});

// Close modal if clicking outside content
favModal.addEventListener('click', (e) => {
    if (e.target === favModal) {
        favModal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
});

// --- SCROLL & SEARCH ---
const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLoading && currentQuery) {
        if ((currentPage * 10) < totalResults) {
            currentPage++;
            fetchMovies(currentQuery, currentPage);
        }
    }
}, { threshold: 1.0 });
observer.observe(loadingTrigger);

const handleSearch = debounce((e) => {
    const query = e.target.value.trim();
    if (query.length < 3) {
        container.innerHTML = '<div class="placeholder-text">Search for a movie to begin...</div>';
        return; 
    }
    currentQuery = query;
    currentPage = 1;
    container.innerHTML = ''; 
    fetchMovies(currentQuery, currentPage);
}, 500);

searchInput.addEventListener('input', handleSearch);
updateFavCount();