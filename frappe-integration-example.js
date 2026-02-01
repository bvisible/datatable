// Exemple d'intégration du DataTable avec Frappe Framework
// Ce fichier montre comment passer la langue de Frappe au DataTable

// Dans le contexte Frappe, lors de l'initialisation du DataTable :

// 1. Détecter la langue depuis frappe.boot.lang
const language = frappe.boot.lang || 'en';

// 2. Créer le DataTable avec la langue appropriée
const datatable = new DataTable('#datatable-container', {
    columns: columns,
    data: data,
    
    // Passer la langue de Frappe
    language: language,
    
    // Optionnellement, ajouter des traductions personnalisées
    translations: {
        // Ajouter des traductions spécifiques si nécessaire
        // Par exemple, pour des termes spécifiques à votre application
    },
    
    // Autres options...
    checkboxColumn: true,
    serialNoColumn: true,
    inlineFilters: true,
    // etc.
});

// Exemple complet dans un contexte Frappe (par exemple dans list_view.js ou report_view.js) :

frappe.views.ListView = class ListView {
    make_datatable() {
        // Récupérer la langue de l'utilisateur depuis Frappe
        const userLanguage = frappe.boot.lang || frappe.boot.user.language || 'en';
        
        // Configuration des colonnes
        const columns = this.get_columns();
        
        // Données à afficher
        const data = this.get_data();
        
        // Initialiser le DataTable avec la langue appropriée
        this.datatable = new DataTable(this.$result[0], {
            columns: columns,
            data: data,
            language: userLanguage,
            
            // Options spécifiques à Frappe
            checkboxColumn: true,
            serialNoColumn: true,
            inlineFilters: true,
            dynamicRowHeight: true,
            
            // Événements
            events: {
                onCheckRow: (row) => {
                    this.on_row_checked(row);
                },
                onSortColumn: (column) => {
                    this.on_sort_column(column);
                }
            },
            
            // Traductions personnalisées si nécessaire
            translations: this.get_custom_translations()
        });
    }
    
    get_custom_translations() {
        // Retourner des traductions personnalisées si nécessaire
        return {
            // Exemple pour le français
            'fr': {
                'No Data': 'Aucune donnée',
                'Sort Ascending': 'Trier par ordre croissant',
                'Sort Descending': 'Trier par ordre décroissant',
                // etc.
            }
        };
    }
}

// Pour les rapports (Report View)
frappe.views.ReportView = class ReportView {
    render_datatable() {
        const language = frappe.boot.lang || 'en';
        
        this.datatable = new DataTable(this.wrapper, {
            columns: this.columns,
            data: this.data,
            language: language,
            
            // Configuration spécifique aux rapports
            showTotalRow: true,
            layout: 'fluid',
            
            // Hooks pour les totaux personnalisés
            hooks: {
                columnTotal: (columnValues, cell) => {
                    // Logique personnalisée pour les totaux
                    return this.calculate_column_total(columnValues, cell);
                }
            }
        });
    }
}

// Notes importantes :
// 1. frappe.boot.lang contient le code de langue de l'utilisateur (ex: 'fr', 'de', 'en')
// 2. Le DataTable supporte actuellement : en, de, fr, it
// 3. Si la langue n'est pas supportée, elle utilisera l'anglais par défaut
// 4. Vous pouvez ajouter des traductions personnalisées via l'option 'translations'