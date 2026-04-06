document.addEventListener('DOMContentLoaded', function () {
    // Get the search input and the list of entries
    const searchInput = document.getElementById('search');
    const entries = document.querySelectorAll('.table-entry');

    // Add an event listener to the search box
    searchInput.addEventListener('input', function () {
        const query = searchInput.value.toLowerCase().trim(); // Get the search query in lowercase
        const queryWords = query.split(/\s+/); // Split the query into individual words

        // Loop through all entries to check if they match the search query
        entries.forEach(function (entry) {
            // Get the content inside the relevant fields (Name, CR, Type)
            const nameElement = entry.querySelectorAll('.content')[1]; // Name is the 2nd .content
            const crElement = entry.querySelectorAll('.content')[2];   // CR is the 3rd .content
            const typeElement = entry.querySelectorAll('.content')[3]; // Type is the 4th .content

            // Get the text content and convert to lowercase
            const nameText = nameElement ? nameElement.textContent.toLowerCase() : ''; 
            const crText = crElement ? crElement.textContent.toLowerCase() : '';
            const typeText = typeElement ? typeElement.textContent.toLowerCase() : '';

            // Combine all fields' text for easier comparison
            const combinedText = `${nameText} ${crText} ${typeText}`;

            // Check if all query words are found in the combined text
            const isMatch = queryWords.every(word => combinedText.includes(word));

            // Show or hide the entry based on the match
            if (isMatch) {
                entry.style.display = 'block'; // Show entry if all words match
            } else {
                entry.style.display = 'none'; // Hide entry if any word doesn't match
            }
        });
    });
});
