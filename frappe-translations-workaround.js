// Solution temporaire pour traduire les éléments du DataTable dans Frappe
// Ajoutez ce code dans un fichier JS personnalisé de Frappe

// Attendez que le DOM soit chargé
frappe.ready(() => {
    // Vérifiez si nous sommes en français
    if (frappe.boot.lang === 'fr') {
        // Observer les changements dans le DOM pour traduire les éléments du DataTable
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // Traduire les placeholders de recherche
                const searchInputs = document.querySelectorAll('.awesomplete__search');
                searchInputs.forEach(input => {
                    if (input.placeholder === 'Search...') {
                        input.placeholder = 'Rechercher...';
                    }
                });

                // Traduire les boutons "Show more"
                const showMoreButtons = document.querySelectorAll('.awesomplete__load-more');
                showMoreButtons.forEach(button => {
                    const text = button.textContent;
                    if (text.includes('Show more')) {
                        button.innerHTML = button.innerHTML.replace('Show more', 'Afficher plus');
                    }
                });

                // Traduire les compteurs "Showing"
                const counters = document.querySelectorAll('.awesomplete__count');
                counters.forEach(counter => {
                    const text = counter.textContent;
                    if (text.includes('Showing')) {
                        counter.textContent = text.replace('Showing', 'Affichage');
                    }
                });

                // Traduire les options de statut dans les checkboxes
                const statusTranslations = {
                    'Open': 'Ouvert',
                    'Closed': 'Fermé',
                    'Pending': 'En attente',
                    'Draft': 'Brouillon',
                    'Submitted': 'Soumis',
                    'Cancelled': 'Annulé',
                    'Completed': 'Terminé',
                    'Active': 'Actif',
                    'Inactive': 'Inactif',
                    'Paid': 'Payé',
                    'Unpaid': 'Impayé',
                    'Approved': 'Approuvé',
                    'Rejected': 'Rejeté',
                    'In Progress': 'En cours',
                    'On Hold': 'En pause',
                    'Yes': 'Oui',
                    'No': 'Non',
                    'Consolidated': 'Consolidé',
                    'Credit Note Issued': 'Note de crédit émise',
                    'Overdue': 'En retard',
                    'Overdue and Discounted': 'En retard et escompté',
                    'Return': 'Retour'
                };

                // Traduire les labels des checkboxes
                const checkboxLabels = document.querySelectorAll('.awesomplete__checkbox-item label');
                checkboxLabels.forEach(label => {
                    const text = label.textContent.trim();
                    if (statusTranslations[text]) {
                        // Conserver la checkbox et remplacer juste le texte
                        const checkbox = label.querySelector('input[type="checkbox"]');
                        if (checkbox) {
                            label.textContent = statusTranslations[text];
                            label.prepend(checkbox);
                        }
                    }
                });
            });
        });

        // Observer tout le body pour capturer les changements
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
});

// Solution alternative : Surcharger la méthode de création du DataTable
// pour toujours passer la langue
(function() {
    const originalDataTable = window.DataTable;
    window.DataTable = function(element, options) {
        // Ajouter automatiquement la langue si elle n'est pas définie
        if (!options.language && frappe && frappe.boot && frappe.boot.lang) {
            options.language = frappe.boot.lang;
        }
        return new originalDataTable(element, options);
    };
    // Copier toutes les propriétés statiques
    Object.setPrototypeOf(window.DataTable, originalDataTable);
    Object.setPrototypeOf(window.DataTable.prototype, originalDataTable.prototype);
})();