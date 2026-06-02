import $ from './dom';
import Sortable from 'sortablejs';
import {
    linkProperties,
    debounce
} from './utils';

export default class ColumnManager {
    constructor(instance) {
        this.instance = instance;

        linkProperties(this, this.instance, [
            'options',
            'fireEvent',
            'header',
            'datamanager',
            'cellmanager',
            'style',
            'wrapper',
            'rowmanager',
            'bodyScrollable',
            'bodyRenderer'
        ]);

        // Add translate method as a shortcut
        this.translate = (str, args) => {
            return this.instance ? this.instance.translate(str, args) : str;
        };

        this.bindEvents();
    }

    renderHeader() {
        this.header.innerHTML = '<div></div>';
        this.refreshHeader();
    }

    refreshHeader() {
        const columns = this.datamanager.getColumns();

        // refresh html
        $('div', this.header).innerHTML = this.getHeaderHTML(columns);

        this.$filterRow = $('.dt-row-filter', this.header);
        if (this.$filterRow) {
            $.style(this.$filterRow, { display: 'none' });
        }
        // reset columnMap
        this.$columnMap = [];
        this.bindMoveColumn();

        // Initialize filters
        this.initializeFilters();
    }

    getHeaderHTML(columns) {
        let html = this.rowmanager.getRowHTML(columns, {
            isHeader: 1
        });
        if (this.options.inlineFilters) {
            html += this.rowmanager.getRowHTML(columns, {
                isFilter: 1
            });
        }
        return html;
    }

    bindEvents() {
        this.bindDropdown();
        this.bindResizeColumn();
        this.bindPerfectColumnWidth();
        this.bindFilter();
    }

    bindDropdown() {
        let toggleClass = '.dt-dropdown__toggle';
        let dropdownClass = '.dt-dropdown__list';

        // attach the dropdown list to container
        this.instance.dropdownContainer.innerHTML = this.getDropdownListHTML();
        this.$dropdownList = this.instance.dropdownContainer.firstElementChild;

        $.on(this.header, 'click', toggleClass, e => {
            this.openDropdown(e);
        });

        const deactivateDropdownOnBodyClick = (e) => {
            const selector = [
                toggleClass, toggleClass + ' *',
                dropdownClass, dropdownClass + ' *'
            ].join(',');
            if (e.target.matches(selector)) return;
            deactivateDropdown();
        };
        $.on(document.body, 'click', deactivateDropdownOnBodyClick);
        document.addEventListener('scroll', deactivateDropdown, true);

        this.instance.on('onDestroy', () => {
            $.off(document.body, 'click', deactivateDropdownOnBodyClick);
            $.off(document, 'scroll', deactivateDropdown);
        });

        $.on(this.$dropdownList, 'click', '.dt-dropdown__list-item', (e, $item) => {
            if (!this._dropdownActiveColIndex) return;
            const dropdownItems = this.options.headerDropdown;
            const { index } = $.data($item);
            const colIndex = this._dropdownActiveColIndex;
            let callback = dropdownItems[index].action;

            callback && callback.call(this.instance, this.getColumn(colIndex));
            this.hideDropdown();
        });

        const _this = this;
        function deactivateDropdown(e) {
            _this.hideDropdown();
        }

        this.hideDropdown();
    }

    openDropdown(e) {
        if (!this._dropdownWidth) {
            $.style(this.$dropdownList, { display: '' });
            this._dropdownWidth = $.style(this.$dropdownList, 'width');
        }
        $.style(this.$dropdownList, {
            display: '',
            left: (e.clientX - this._dropdownWidth + 4) + 'px',
            top: (e.clientY + 4) + 'px'
        });
        const $cell = $.closest('.dt-cell', e.target);
        const { colIndex } = $.data($cell);
        this._dropdownActiveColIndex = colIndex;
    }

    hideDropdown() {
        $.style(this.$dropdownList, {
            display: 'none'
        });
        this._dropdownActiveColIndex = null;
    }

    bindResizeColumn() {
        let isDragging = false;
        let $resizingCell, startWidth, startX;

        $.on(this.header, 'mousedown', '.dt-cell .dt-cell__resize-handle', (e, $handle) => {
            document.body.classList.add('dt-resize');
            const $cell = $handle.parentNode.parentNode;
            $resizingCell = $cell;
            const {
                colIndex
            } = $.data($resizingCell);
            const col = this.getColumn(colIndex);

            if (col && col.resizable === false) {
                return;
            }

            isDragging = true;
            startWidth = $.style($('.dt-cell__content', $resizingCell), 'width');
            startX = e.pageX;
        });

        const onMouseup = (e) => {
            document.body.classList.remove('dt-resize');
            if (!$resizingCell) return;
            isDragging = false;

            const {
                colIndex
            } = $.data($resizingCell);
            this.setColumnWidth(colIndex);
            this.style.setBodyStyle();
            $resizingCell = null;
        };
        $.on(document.body, 'mouseup', onMouseup);
        this.instance.on('onDestroy', () => {
            $.off(document.body, 'mouseup', onMouseup);
        });

        const onMouseMove = (e) => {
            if (!isDragging) return;
            let delta = e.pageX - startX;
            if (this.options.direction === 'rtl') {
                delta = -1 * delta;
            }
            const finalWidth = startWidth + delta;
            const {
                colIndex
            } = $.data($resizingCell);

            let columnMinWidth = this.options.minimumColumnWidth;
            if (columnMinWidth > finalWidth) {
                // don't resize past 30 pixels
                return;
            }
            this.datamanager.updateColumn(colIndex, {
                width: finalWidth
            });
            this.setColumnHeaderWidth(colIndex);
        };
        $.on(document.body, 'mousemove', onMouseMove);
        this.instance.on('onDestroy', () => {
            $.off(document.body, 'mousemove', onMouseMove);
        });
    }

    bindPerfectColumnWidth() {
        $.on(this.header, 'dblclick', '.dt-cell .dt-cell__resize-handle', (e, $handle) => {
            const $cell = $handle.parentNode.parentNode;
            const { colIndex } = $.data($cell);

            let longestCell = this.bodyRenderer.visibleRows
                .map(d => d[colIndex])
                .reduce((acc, curr) => acc.content.length > curr.content.length ? acc : curr);

            let $longestCellHTML = this.cellmanager.getCellHTML(longestCell);
            let $div = document.createElement('div');
            $div.innerHTML = $longestCellHTML;
            let cellText = $div.querySelector('.dt-cell__content').textContent;

            let {
                borderLeftWidth,
                borderRightWidth,
                paddingLeft,
                paddingRight
            } = $.getStyle(this.bodyScrollable.querySelector('.dt-cell__content'));

            let padding = [borderLeftWidth, borderRightWidth, paddingLeft, paddingRight]
                .map(parseFloat)
                .reduce((sum, val) => sum + val);

            let width = $.measureTextWidth(cellText) + padding;
            this.datamanager.updateColumn(colIndex, { width });
            this.setColumnHeaderWidth(colIndex);
            this.setColumnWidth(colIndex);
        });
    }

    bindMoveColumn() {
        if (this.options.disableReorderColumn) return;

        const $parent = $('.dt-row', this.header);

        this.sortable = Sortable.create($parent, {
            onEnd: (e) => {
                const {
                    oldIndex,
                    newIndex
                } = e;
                const $draggedCell = e.item;
                const {
                    colIndex
                } = $.data($draggedCell);
                if (+colIndex === newIndex) return;

                this.switchColumn(oldIndex, newIndex);
            },
            preventOnFilter: false,
            filter: '.dt-cell__resize-handle, .dt-dropdown',
            chosenClass: 'dt-cell--dragging',
            animation: 150
        });
    }

    sortColumn(colIndex, nextSortOrder) {
        cur_list.page_length = 10000;
        cur_list.refresh().then(() => {
            setTimeout(() => {
                this.instance.freeze();
                this.sortRows(colIndex, nextSortOrder)
                    .then(() => {
                        this.refreshHeader();
                        return this.rowmanager.refreshRows();
                    })
                    .then(() => {
                        this.instance.unfreeze();
                        const filters = this.getAppliedFilters();
                        return this.datamanager.filterRows(filters);
                    })
                    .then(() => {
                        this.fireEvent('onSortColumn', this.getColumn(colIndex));
                        this.setSortState();
                    });
            }, 200);
        });

    }

    saveSorting(colIndex) {
        let currentColumn = this.getColumn(colIndex);
        let saveSorting = {
            [currentColumn.name]: {
                colIndex: colIndex,
                sortOrder: currentColumn.sortOrder
            }
        };
        this.sortingKey = this.options.sortingKey ? `${this.options.sortingKey}::sortedColumns` : 'sortedColumns' ;
        localStorage.setItem(this.sortingKey, JSON.stringify(saveSorting));
    }
    setSortState(sortOrder) {
        if (sortOrder === 'none') {
            this.sortState = false;
        } else {
            this.sortState = true;
        }
    }

    removeColumn(colIndex) {
        const removedCol = this.getColumn(colIndex);
        this.instance.freeze();
        this.datamanager.removeColumn(colIndex)
            .then(() => {
                this.refreshHeader();
                return this.rowmanager.refreshRows();
            })
            .then(() => this.instance.unfreeze())
            .then(() => {
                this.fireEvent('onRemoveColumn', removedCol);
            });
    }

    switchColumn(oldIndex, newIndex) {
        this.instance.freeze();
        this.datamanager.switchColumn(oldIndex, newIndex)
            .then(() => {
                this.refreshHeader();
                return this.rowmanager.refreshRows();
            })
            .then(() => {
                this.setColumnWidth(oldIndex);
                this.setColumnWidth(newIndex);
                this.instance.unfreeze();
            })
            .then(() => {
                this.fireEvent('onSwitchColumn',
                    this.getColumn(oldIndex), this.getColumn(newIndex)
                );
            });
    }

    toggleFilter(flag) {
        if (!this.options.inlineFilters) return;

        let showFilter;
        if (flag === undefined) {
            showFilter = !this.isFilterShown;
        } else {
            showFilter = flag;
        }

        if (showFilter) {
            $.style(this.$filterRow, { display: '' });
        } else {
            $.style(this.$filterRow, { display: 'none' });
            // Clear saved filters if filters are hidden and clear flag is true
            if (flag === false) {
                const doctype = this.getDocTypeFromURL() || this.options.doctype || 'undefined';
                const instanceName = this.instance.name || '';
                localStorage.removeItem('dt-filters-' + (instanceName ? instanceName + '-' : '') + doctype);
            }
        }

        this.isFilterShown = showFilter;
        this.style.setBodyStyle();
    }

    focusFilter(colIndex) {
        if (!this.isFilterShown) return;

        const $filterInput = $(`.dt-cell--col-${colIndex} .dt-filter`, this.$filterRow);
        $filterInput.focus();
    }

    bindFilter() {
        if (!this.options.inlineFilters) return;
        const handler = e => {
            const filters = this.getAppliedFilters();
            // Save filters to localStorage with doctype from URL
            const doctype = this.getDocTypeFromURL() || this.options.doctype || 'undefined';
            const instanceName = this.instance.name || '';
            const key = 'dt-filters-' + (instanceName ? instanceName + '-' : '') + doctype;
            localStorage.setItem(key, JSON.stringify(filters));
            this.applyFilter(filters);
        };
        $.on(this.header, 'keydown', '.dt-filter', debounce(handler, 300));
    }

    getDocTypeFromURL() {
        const path = window.location.pathname;
        if (path.includes('/app/')) {
            // Format: /app/doctype or /app/doctype/name
            const parts = path.split('/');
            // Find the index after "/app/"
            const appIndex = parts.findIndex(part => part === 'app');
            if (appIndex !== -1 && parts.length > appIndex + 1) {
                return parts[appIndex + 1]; // Return the doctype part
            }
        }
        return null;
    }

    applyFilter(filters) {
        this.datamanager.filterRows(filters)
            .then(({
                rowsToShow
            }) => {
                this.rowmanager.showRows(rowsToShow);
            });
    }

    getAppliedFilters() {
        const filters = {};
        $.each('.dt-filter', this.header).map((input) => {
            const value = input.value;
            if (value) {
                filters[input.dataset.colIndex] = value;
            }
        });
        return filters;
    }

    applyDefaultSortOrder() {
        // sort rows if any 1 column has a default sortOrder set
        const columnsToSort = this.getColumns().filter(col => col.sortOrder !== 'none');

        if (columnsToSort.length === 1) {
            const column = columnsToSort[0];
            this.sortColumn(column.colIndex, column.sortOrder);
        }
    }

    applySavedSortOrder() {

        let key = this.options.sortingKey ? `${this.options.sortingKey}::sortedColumns` : 'sortedColumns' ;
        let sortingConfig = JSON.parse(localStorage.getItem(key));
        if (sortingConfig) {
            const columnsToSort = Object.values(sortingConfig);
            for (let column of columnsToSort) {
                this.sortColumn(column.colIndex, column.sortOrder);
                this.sortState = true;
            }
        }
    }

    sortRows(colIndex, sortOrder) {
        return this.datamanager.sortRows(colIndex, sortOrder);
    }

    getColumn(colIndex) {
        return this.datamanager.getColumn(colIndex);
    }

    getColumns() {
        return this.datamanager.getColumns();
    }

    setColumnWidth(colIndex, width) {
        colIndex = +colIndex;

        let columnWidth = width || this.getColumn(colIndex).width;

        const selector = [
            `.dt-cell__content--col-${colIndex}`,
            `.dt-cell__edit--col-${colIndex}`
        ].join(', ');

        const styles = {
            width: columnWidth + 'px'
        };

        this.style.setStyle(selector, styles);
    }

    setColumnHeaderWidth(colIndex) {
        colIndex = +colIndex;
        this.$columnMap = this.$columnMap || [];
        const selector = `.dt-cell__content--header-${colIndex}`;
        const {
            width
        } = this.getColumn(colIndex);

        let $column = this.$columnMap[colIndex];
        if (!$column) {
            $column = this.header.querySelector(selector);
            this.$columnMap[colIndex] = $column;
        }

        $column.style.width = width + 'px';
    }

    getColumnMinWidth(colIndex) {
        colIndex = +colIndex;
        return this.getColumn(colIndex).minWidth || 24;
    }

    getFirstColumnIndex() {
        return this.datamanager.getColumnIndexById('_rowIndex') + 1;
    }

    getHeaderCell$(colIndex) {
        return $(`.dt-cell--header-${colIndex}`, this.header);
    }

    getLastColumnIndex() {
        return this.datamanager.getColumnCount() - 1;
    }

    getDropdownHTML() {
        const { dropdownButton } = this.options;

        return `
            <div class="dt-dropdown">
                <div class="dt-dropdown__toggle">${dropdownButton}</div>
            </div>
      `;
    }

    getDropdownListHTML() {
        const { headerDropdown: dropdownItems } = this.options;
        return `
        <div class="dt-dropdown__list">
        ${dropdownItems.map((d, i) => `
            <div 
                class="dt-dropdown__list-item${d.display ? ' dt-hidden' : ''}" 
                data-index="${i}"
            >
                ${d.label}
            </div>
        `).join('')}
        </div>
    `;
    }

    toggleDropdownItem(index) {
        $('.dt-dropdown__list', this.instance.dropdownContainer).children[index].classList.toggle('dt-hidden');
    }

    initializeFilters() {
        // Try to restore filters from localStorage with doctype from URL
        let savedFilters = {};
        try {
            const doctype = this.getDocTypeFromURL() || this.options.doctype || 'undefined';
            const instanceName = this.instance.name || '';
            const savedFiltersStr = localStorage.getItem('dt-filters-' + (instanceName ? instanceName + '-' : '') + doctype);
            if (savedFiltersStr) {
                savedFilters = JSON.parse(savedFiltersStr);
            }
        } catch (e) {
            console.error('Error loading saved filters:', e);
        }

        this.initializeDateFilters();
        this.initializeSelectFilters();

        // Apply saved filters after initialization
        if (Object.keys(savedFilters).length > 0) {
            // Set filter input values based on saved filters
            $.each('.dt-filter', this.header).forEach(input => {
                const colIndex = input.dataset.colIndex;
                if (savedFilters[colIndex]) {
                    input.value = savedFilters[colIndex];
                }
            });

            // Apply the filters
            this.applyFilter(savedFilters);
        }
    }

    initializeDateFilters() {
        const dateInputs = $.each('.date-filter', this.header);
        dateInputs.forEach(input => {
            jQuery(input).datepicker({
                changeMonth: true,
                changeYear: true,
                dateFormat: 'dd-mm-yyyy',
                language: frappe.boot.lang,
                onSelect: (dateText) => {
                    const colIndex = input.dataset.colIndex;
                    this.applyFilter(this.getAppliedFilters());
                }
            });
        });
    }

    initializeSelectFilters() {
        const selectInputs = $.each('.select-filter', this.header);
        const promises = selectInputs.map(input => {
            const colIndex = input.dataset.colIndex;
            const column = this.datamanager.getColumn(colIndex);
            // Script/query reports carry no `docfield` and no list view (`cur_list`)
            // context, while the autocomplete options are fetched through a
            // list-view server call. Skip initialisation here so the field simply
            // behaves as a plain text (contains) filter instead of throwing.
            if (!column || !column.docfield || !column.docfield.fieldtype ||
                typeof cur_list === 'undefined' || !cur_list) {
                return Promise.resolve();
            }
            const fieldtype = column.docfield.fieldtype;

            if (fieldtype === 'Check') {
                const options = ['Yes', 'No'].sort();
                this.initializeAwesomplete(input, options, true);
                return Promise.resolve();
            } else if (fieldtype === 'Select') {
                const options = column.docfield.options ? column.docfield.options.split('\n').filter(option => option).sort() : [];
                this.initializeAwesomplete(input, options);
                return Promise.resolve();
            } else if (fieldtype === 'Link') {
                return frappe.call({
                    method: 'frappe.desk.reportview.get_distinct_values',
                    args: {
                        doctype: column.docfield.options,
                        fieldname: 'name',
                        limit: 10000,
                        filters: cur_list.get_filters_for_args()
                    }
                }).then(r => {
                    if (r.message) {
                        const options = r.message.map(item => item.name).filter(value => value !== null && value !== undefined).sort();
                        this.initializeAwesomplete(input, options);
                    }
                });
            }
        });

        Promise.all(promises).then(() => {
        }).catch(error => {
            console.error('Error initializing select filters:', error);
        });
    }

    /*
    initializeSelectFilters() {
        const selectInputs = $.each('.dt-filter', this.header);
        const promises = selectInputs.map(input => {
            const colIndex = input.dataset.colIndex;
            const column = this.datamanager.getColumn(colIndex);

            if (!column || !column.docfield || !column.docfield.fieldtype) {
                return Promise.resolve();
            }

            const fieldtype = column.docfield.fieldtype;
            const fieldname = column.docfield.fieldname || "name";

            if (fieldtype === 'Check') {
                const options = ['Yes', 'No'].sort();
                this.initializeAwesomplete(input, options, true);
                return Promise.resolve();
            } else if (fieldtype === 'Select') {
                const options = column.docfield.options ? column.docfield.options.split('\n').filter(option => option).sort() : [];
                this.initializeAwesomplete(input, options);
                return Promise.resolve();
            } else if (fieldtype === 'Data' && column.name != "Meta") {
                return frappe.call({
                    method: 'frappe.desk.reportview.get_distinct_values',
                    args: {
                        doctype: column.docfield.parent,
                        fieldname: fieldname,
                        limit: 10000,
                        filters: cur_list.get_filters_for_args()
                    }
                }).then(r => {
                    if (r.message) {
                        const options = r.message.map(item => item[fieldname]).filter(value => value !== null && value !== undefined).sort();
                        this.initializeAwesomplete(input, options);
                    }
                });
            } else if (fieldtype === 'Link') {
                return frappe.call({
                    method: 'frappe.desk.reportview.get_distinct_values',
                    args: {
                        doctype: column.docfield.options,
                        fieldname: "name",
                        limit: 10000,
                        filters: cur_list.get_filters_for_args()
                    }
                }).then(r => {
                    if (r.message) {
                        const options = r.message.map(item => item.name).filter(value => value !== null && value !== undefined).sort();
                        this.initializeAwesomplete(input, options);
                    }
                });
            }
        });

        Promise.all(promises).then(() => {
        }).catch(error => {
            console.error('Error initializing select filters:', error);
        });
    }*/

    initializeAwesomplete(input, options, isCheckField = false) {
        // Configuration du lazy loading
        const ITEMS_PER_PAGE = this.options.itemsPerPage || 20;
        let currentPage = 0;
        let filteredOptions = [...options];
        let inactivityTimer = null;

        // Créer un conteneur personnalisé pour la liste avec un champ de recherche
        const awesompleteContainer = document.createElement('div');
        awesompleteContainer.classList.add('awesomplete');
        awesompleteContainer.style.display = 'none'; // Masquer par défaut
        document.body.appendChild(awesompleteContainer);

        // Fonction pour réinitialiser le timer d'inactivité
        const resetInactivityTimer = () => {
            if (inactivityTimer) {
                clearTimeout(inactivityTimer);
            }
            inactivityTimer = setTimeout(() => {
                if (awesompleteContainer.style.display !== 'none') {
                    awesompleteContainer.style.display = 'none';
                }
            }, 5000); // 5 secondes
        };

        // Fonction pour arrêter le timer
        const stopInactivityTimer = () => {
            if (inactivityTimer) {
                clearTimeout(inactivityTimer);
                inactivityTimer = null;
            }
        };

        // Champ de recherche pour filtrer les options
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.classList.add('awesomplete__search');
        searchInput.placeholder = this.translate('Search...');
        searchInput.style.paddingRight = '24px'; // Ajoute un espace pour la croix
        awesompleteContainer.appendChild(searchInput);

        // Ajouter la croix de réinitialisation dans l'input de recherche
        const clearButton = document.createElement('span');
        clearButton.classList.add('awesomplete__clear');
        clearButton.innerHTML = '&times;'; // Symbole de croix
        clearButton.style.cursor = 'pointer';
        clearButton.style.position = 'absolute';
        clearButton.style.right = '10px';
        clearButton.style.top = '50%';
        clearButton.style.transform = 'translateY(-50%)';
        clearButton.style.fontSize = '18px';
        clearButton.style.color = '#999';

        // Ajouter la croix dans l'input de recherche
        const searchInputContainer = document.createElement('div');
        searchInputContainer.style.position = 'relative';
        searchInputContainer.appendChild(searchInput);
        searchInputContainer.appendChild(clearButton);
        awesompleteContainer.appendChild(searchInputContainer);

        // Ajouter la fonction de réinitialisation
        clearButton.addEventListener('click', () => {
            resetInactivityTimer(); // Réinitialiser le timer
            input.value = ''; // Réinitialiser l'input principal
            searchInput.value = ''; // Réinitialiser le champ de recherche
            renderOptions(); // Réafficher toutes les options

            // Mettre à jour les filtres dans le localStorage après réinitialisation
            const filters = this.getAppliedFilters();
            const doctype = this.getDocTypeFromURL() || this.options.doctype || 'undefined';
            const instanceName = this.instance.name || '';
            const key = 'dt-filters-' + (instanceName ? instanceName + '-' : '') + doctype;
            localStorage.setItem(key, JSON.stringify(filters));

            this.applyFilter(filters); // Appliquer les filtres mis à jour

            // Remettre le focus sur le champ de recherche
            searchInput.focus();
        });

        const checkboxList = document.createElement('ul');
        checkboxList.classList.add('awesomplete__checkbox-list');
        awesompleteContainer.appendChild(checkboxList);

        // Fonction pour afficher les options filtrées avec lazy loading
        const renderOptions = (filter = '', reset = true) => {
            if (reset) {
                currentPage = 0;
                checkboxList.innerHTML = '';
                filteredOptions = options.filter(option =>
                    option.toLowerCase().includes(filter.toLowerCase())
                );
            }

            const startIndex = currentPage * ITEMS_PER_PAGE;
            const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredOptions.length);
            const optionsToShow = filteredOptions.slice(startIndex, endIndex);

            optionsToShow.forEach(option => {
                const listItem = document.createElement('li');
                listItem.classList.add('awesomplete__checkbox-item');

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = option;
                checkbox.classList.add('awesomplete__checkbox');

                const label = document.createElement('label');
                // Traduire l'option si une traduction est disponible
                let translatedOption = this.translate(option);
                label.textContent = translatedOption;
                label.prepend(checkbox);

                // Restaurer l'état de sélection des checkboxes si elles sont déjà sélectionnées
                if (input.value.split('; ').includes(option)) {
                    checkbox.checked = true;
                }

                listItem.appendChild(label);
                checkboxList.appendChild(listItem);

                checkbox.addEventListener('change', (event) => {
                    // Empêcher la fermeture lors du clic sur une checkbox
                    event.stopPropagation();
                    resetInactivityTimer(); // Réinitialiser le timer
                    this.handleCheckboxSelection(input, checkboxList, isCheckField);

                    // Maintenir le focus sur le champ de recherche après sélection
                    setTimeout(() => {
                        searchInput.focus();
                    }, 0);
                });
            });

            // Ajouter ou mettre à jour le bouton "Afficher plus"
            const existingLoadMore = checkboxList.querySelector('.awesomplete__load-more');
            if (existingLoadMore) {
                existingLoadMore.remove();
            }

            if (endIndex < filteredOptions.length) {
                const loadMoreItem = document.createElement('li');
                loadMoreItem.classList.add('awesomplete__load-more');
                loadMoreItem.style.textAlign = 'center';
                loadMoreItem.style.padding = '8px';
                loadMoreItem.style.cursor = 'pointer';
                loadMoreItem.style.backgroundColor = '#f5f5f5';
                loadMoreItem.style.borderTop = '1px solid #ddd';

                const remainingCount = filteredOptions.length - endIndex;
                const showMoreText = this.translate('Show more');
                loadMoreItem.innerHTML = `<strong>${showMoreText} (${remainingCount})</strong>`;

                loadMoreItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    resetInactivityTimer(); // Réinitialiser le timer
                    currentPage++;
                    renderOptions(searchInput.value, false);
                });

                checkboxList.appendChild(loadMoreItem);
            }

            // Afficher le nombre total d'éléments
            const existingCount = awesompleteContainer.querySelector('.awesomplete__count');
            if (existingCount) {
                existingCount.remove();
            }

            if (filteredOptions.length > ITEMS_PER_PAGE) {
                const countDiv = document.createElement('div');
                countDiv.classList.add('awesomplete__count');
                countDiv.style.padding = '4px 8px';
                countDiv.style.fontSize = '12px';
                countDiv.style.color = '#666';
                countDiv.style.borderBottom = '1px solid #ddd';
                const showing = Math.min(endIndex, filteredOptions.length);
                const total = filteredOptions.length;
                const showingText = this.translate('Showing');
                countDiv.textContent = `${showingText} ${showing} / ${total}`;

                // Insérer après le champ de recherche
                searchInputContainer.insertAdjacentElement('afterend', countDiv);
            }
        };

        // Filtrer les options au fur et à mesure que l'utilisateur tape
        searchInput.addEventListener('input', () => {
            resetInactivityTimer(); // Réinitialiser le timer
            renderOptions(searchInput.value);
            input.value = searchInput.value;

            // Mettre à jour les filtres dans le localStorage lorsqu'on tape
            const filters = this.getAppliedFilters();
            const doctype = this.getDocTypeFromURL() || this.options.doctype || 'undefined';
            const instanceName = this.instance.name || '';
            const key = 'dt-filters-' + (instanceName ? instanceName + '-' : '') + doctype;
            localStorage.setItem(key, JSON.stringify(filters));

            this.applyFilter(filters);
        });

        // Initialiser la liste avec toutes les options
        renderOptions();

        input.addEventListener('focus', () => {
            awesompleteContainer.style.display = 'block';
            resetInactivityTimer(); // Démarrer le timer

            const rect = input.getBoundingClientRect();
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            awesompleteContainer.style.position = 'absolute';
            awesompleteContainer.style.left = `${rect.left + scrollLeft}px`;
            awesompleteContainer.style.top = `${rect.bottom + scrollTop + 10}px`;
            awesompleteContainer.style.width = '250px';

            // Utiliser setTimeout pour garantir que le focus est bien appliqué
            setTimeout(() => {
                searchInput.focus();
            }, 0);
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                // Masquer la liste seulement si l'utilisateur n'a pas cliqué sur une option
                if (!awesompleteContainer.contains(document.activeElement)) {
                    awesompleteContainer.style.display = 'none';
                    stopInactivityTimer(); // Arrêter le timer
                }
            }, 200); // Retard pour permettre de cliquer sur une case à cocher avant que la liste ne soit cachée
        });

        // Empêcher la fermeture lors du clic sur la liste
        awesompleteContainer.addEventListener('mousedown', (event) => {
            event.preventDefault();
        });

        // Réinitialiser le timer lors du mouvement de la souris
        awesompleteContainer.addEventListener('mousemove', () => {
            resetInactivityTimer();
        });

        // Fermer la liste en cliquant à l'extérieur
        document.addEventListener('click', (event) => {
            if (!awesompleteContainer.contains(event.target) && event.target !== input) {
                awesompleteContainer.style.display = 'none';
                stopInactivityTimer(); // Arrêter le timer
            }
        });
    }

    handleCheckboxSelection(input, checkboxList, isCheckField) {
        const selectedValues = [];

        checkboxList.querySelectorAll('input:checked').forEach(checkbox => {
            let value = checkbox.value;
            if (isCheckField) {
                value = value === 'Yes' ? '1' : '0';
            }
            if (!selectedValues.includes(value)) {
                selectedValues.push(value);
            }
        });

        checkboxList.querySelectorAll('input:not(:checked)').forEach(checkbox => {
            let value = checkbox.value;
            if (isCheckField) {
                value = value === 'Yes' ? '1' : '0';
            }
            const index = selectedValues.indexOf(value);
            if (index > -1) {
                selectedValues.splice(index, 1);
            }
        });

        // Mettre à jour l'input avec les valeurs sélectionnées, séparées par ";"
        input.value = selectedValues.join('; ');

        // Get current filters and save to localStorage with doctype from URL
        const filters = this.getAppliedFilters();
        const doctype = this.getDocTypeFromURL() || this.options.doctype || 'undefined';
        const instanceName = this.instance.name || '';
        localStorage.setItem('dt-filters-' + (instanceName ? instanceName + '-' : '') + doctype, JSON.stringify(filters));

        // Appliquer les filtres
        this.applyFilter(filters);
    }
}
