import { isNumber, stripHTML } from './utils';
import CellManager from './cellmanager';

function cleanDateString(dateString) {
    const dateFormats = [
        { regex: /^\d{2}-\d{2}-\d{4}$/, format: 'DD-MM-YYYY' },
        { regex: /^\d{4}-\d{2}-\d{2}$/, format: 'YYYY-MM-DD' }
    ];

    for (let { regex, format } of dateFormats) {
        if (regex.test(dateString)) {
            const dateParts = dateString.split('-');
            let day, month, year;
            if (format === 'DD-MM-YYYY') {
                day = dateParts[0].padStart(2, '0');
                month = dateParts[1].padStart(2, '0');
                year = dateParts[2];
            } else if (format === 'YYYY-MM-DD') {
                year = dateParts[0];
                month = dateParts[1].padStart(2, '0');
                day = dateParts[2].padStart(2, '0');
            }
            if (isValidDate(day, month, year)) {
                return `${year}-${month}-${day}`;
            }
        }
    }

    console.error('Invalid date string:', dateString);
    return null;
}

function isValidDate(day, month, year) {
    const date = new Date(`${year}-${month}-${day}`);
    return date.getFullYear() == year && (date.getMonth() + 1) == month && date.getDate() == day;
}

function processFilter(column, keyword, doctype) {
    if (column && column.docfield && column.docfield.fieldtype === 'Currency') {
        return [doctype, column.id, 'like', `${keyword}%`];
    } else if (column && column.docfield && column.docfield.fieldtype === 'Percent') {
        // Vérifier si le champ est de type Percent
        const parsedKeyword = parseFloat(keyword);
        if (!isNaN(parsedKeyword)) {
            // Retourner un filtre exact si le mot-clé est un nombre (comme 0)
            return [doctype, column.id, '=', parsedKeyword];
        } else {
            console.error('Invalid percent format:', keyword);
            return null;
        }
    } else if (column && column.id.includes(':')) {
        const [childDoctype, childField] = column.id.split(':');
        return [childDoctype, childField, 'like', `%${keyword}%`];
    } else if (column) {
        if (keyword.includes(';')) {
            const keywordsArray = keyword.split(';').map(k => k.trim());
            return [doctype, column.id, 'in', keywordsArray];
        }
        if (column.docfield.fieldtype === 'Date') {
            const cleanedDate = cleanDateString(keyword);
            if (cleanedDate) {
                return [doctype, column.id, '=', cleanedDate];
            } else {
                console.error('Invalid date format:', keyword);
                return null;
            }
        } else if (column.docfield.fieldtype === 'Select' || column.docfield.fieldtype === 'Link') {
            if (keyword.includes(';')) {
                const keywordsArray = keyword.split(';').map(k => k.trim());
                return [doctype, column.id, 'in', keywordsArray];
            } else {
                return [doctype, column.id, 'like', `%${keyword}%`];
            }
        }        
        return [doctype, column.id, 'like', `%${keyword}%`];
    } else {
        console.warn(`Colonne invalide à l'index ${colIndex}`);
        return null;
    }
}

export default function filterRows(rows, filters, data, start = 0, page_length = 10000) {
    return new Promise((resolve, reject) => {
        const doctype = cur_list.doctype;
        let frappeFilters = [];

        const existingFilters = cur_list.get_filters_for_args();
        frappeFilters = frappeFilters.concat(existingFilters);

        Object.keys(filters).forEach(colIndex => {
            const keyword = filters[colIndex];
            const column = data.columns.find(col => col.colIndex == colIndex);
            const filter = processFilter(column, keyword, doctype);
            if (filter) {
                frappeFilters.push(filter);
            }
        });

        const args = cur_list.get_call_args();
        args.args.filters = frappeFilters;
        args.args.start = start;
        args.args.page_length = page_length;

        frappe.call(args).then(r => {
            cur_list.prepare_data(r);
            let page_length = r.message.values.length
            const pagingArea = cur_list.$paging_area[0];

            const listCountElement = pagingArea.querySelector('.list-count');
            if (listCountElement) {
                listCountElement.textContent = page_length; 
            }
            const btnMore = pagingArea.querySelector('.btn-more');
            if (btnMore) {
                btnMore.style.display = 'none';
            }

            if (page_length < 100) {
                page_length = 100;
            }
            cur_list.page_length = page_length;
            cur_list.total_count = page_length;
            
            const formattedRows = cur_list.data.map((rowData, rowIndex) => {
                return data.columns
                    .filter(column => column.visible !== false)
                    .map((column, colIndex) => {
                        const cellClass = `dt-cell dt-cell--col-${colIndex} dt-cell--${colIndex}-${rowIndex} dt-cell--row-${rowIndex}`;
                        const contentClass = `dt-cell__content dt-cell__content--col-${colIndex}`;
                        let cellData = null;

                        if (column.id.includes(':')) {
                            const [childDoctype, childField] = column.id.split(':');
                            const childData = rowData[`${childDoctype}:${childField}`];
                            cellData = childData || rowData[childField] || null;
                        } else {
                            cellData = rowData[column.field] || null;
                        }

                        if (column.field === "meta") {
                            return {
                                content: cur_list.get_meta_html(rowData),
                                rowIndex: rowIndex,
                                colIndex: colIndex,
                                column: column,
                                sortOrder: column.sortOrder,
                                editable: column.editable,
                                focusable: column.focusable,
                                dropdown: column.dropdown,
                                width: column.width,
                                name: column.name,
                                docfield: column.docfield || {},
                                attributes: {
                                    class: cellClass,
                                    "data-row-index": rowIndex,
                                    "data-col-index": colIndex,
                                    "tabindex": 0
                                },
                                contentAttributes: {
                                    class: contentClass,
                                    title: cellData ? cellData.toString() : ''
                                }
                            };
                        }

                        if (column.id === '_checkbox') {
                            cellData = '<input type="checkbox">';
                        } else if (column.id === '_rowIndex') {
                            cellData = rowIndex + 1;
                        }

                        return {
                            content: cellData,
                            rowIndex: rowIndex,
                            colIndex: colIndex,
                            column: column,
                            sortOrder: column.sortOrder,
                            editable: column.editable,
                            focusable: column.focusable,
                            dropdown: column.dropdown,
                            width: column.width,
                            name: column.name,
                            docfield: column.docfield || {},
                            attributes: {
                                class: cellClass,
                                "data-row-index": rowIndex,
                                "data-col-index": colIndex,
                                "tabindex": 0
                            },
                            contentAttributes: {
                                class: contentClass,
                                title: cellData ? cellData.toString() : ''
                            }
                        };
                    });
            });

            // Appliquer le tri si une colonne est triée
            const sortedColumn = data.columns.find(col => col.sortOrder && col.sortOrder !== 'none');
            if (sortedColumn) {
                formattedRows.sort((a, b) => {
                    const aValue = a.find(cell => cell.colIndex === sortedColumn.colIndex).content;
                    const bValue = b.find(cell => cell.colIndex === sortedColumn.colIndex).content;
                    if (sortedColumn.sortOrder === 'asc') {
                        return aValue > bValue ? 1 : -1;
                    } else {
                        return aValue < bValue ? 1 : -1;
                    }
                });
            }

            formattedRows.forEach((row, rowIndex) => {
                row.meta = row.meta || {};
                row.meta.rowIndex = rowIndex;
                row.meta.indent = row.meta.indent || 0;
                row.meta.isLeaf = row.meta.isLeaf !== undefined ? row.meta.isLeaf : true;
                row.meta.isTreeNodeClose = row.meta.isTreeNodeClose !== undefined ? row.meta.isTreeNodeClose : false;
            });

            data.rows = formattedRows;

            if (typeof data.refresh === 'function') {
                data.refresh(formattedRows);
            }

            resolve(formattedRows);
        }).catch(error => {
            console.error('Erreur lors de l\'appel de Frappe:', error);
            reject(error);
        });
    });
}


function getFilterMethod(rows, allData, filter) {
    const getFormattedValue = cell => {
        let formatter = CellManager.getCustomCellFormatter(cell);
        let rowData = rows[cell.rowIndex];
        if (allData && allData.data && allData.data.length) {
            rowData = allData.data[cell.rowIndex];
        }
        if (formatter && cell.content) {
            cell.html = formatter(cell.content, rows[cell.rowIndex], cell.column, rowData, filter);
            return stripHTML(cell.html);
        }
        return cell.content || '';
    };

    const stringCompareValue = cell =>
        String(stripHTML(cell.html || '') || getFormattedValue(cell)).toLowerCase();

    const numberCompareValue = cell => parseFloat(cell.content);

    const getCompareValues = (cell, keyword) => {
        if (cell.column.compareValue) {
            const compareValues = cell.column.compareValue(cell, keyword);
            if (compareValues && Array.isArray(compareValues)) return compareValues;
        }

        // check if it can be converted to number
        const float = numberCompareValue(cell);
        if (!isNaN(float)) {
            return [float, keyword];
        }

        return [stringCompareValue(cell), keyword];
    };

    let filterMethodMap = {
        contains(keyword, cells) {
            return cells
                .filter(cell => {
                    const needle = (keyword || '').toLowerCase();
                    return !needle ||
                        (cell.content || '').toLowerCase().includes(needle) ||
                        stringCompareValue(cell).includes(needle);
                })
                .map(cell => cell.rowIndex);
        },

        greaterThan(keyword, cells) {
            return cells
                .filter(cell => {
                    const [compareValue, keywordValue] = getCompareValues(cell, keyword);
                    return compareValue > keywordValue;
                })
                .map(cell => cell.rowIndex);
        },

        lessThan(keyword, cells) {
            return cells
                .filter(cell => {
                    const [compareValue, keywordValue] = getCompareValues(cell, keyword);
                    return compareValue < keywordValue;
                })
                .map(cell => cell.rowIndex);
        },

        equals(keyword, cells) {
            return cells
                .filter(cell => {
                    const value = parseFloat(cell.content);
                    return value === keyword;
                })
                .map(cell => cell.rowIndex);
        },

        notEquals(keyword, cells) {
            return cells
                .filter(cell => {
                    const value = parseFloat(cell.content);
                    return value !== keyword;
                })
                .map(cell => cell.rowIndex);
        },

        range(rangeValues, cells) {
            return cells
                .filter(cell => {
                    const values1 = getCompareValues(cell, rangeValues[0]);
                    const values2 = getCompareValues(cell, rangeValues[1]);
                    const value = values1[0];
                    return value >= values1[1] && value <= values2[1];
                })
                .map(cell => cell.rowIndex);
        },

        containsNumber(keyword, cells) {
            return cells
                .filter(cell => {
                    let number = parseFloat(keyword, 10);
                    let string = keyword;
                    let hayNumber = numberCompareValue(cell);
                    let hayString = stringCompareValue(cell);

                    return number === hayNumber || hayString.includes(string);
                })
                .map(cell => cell.rowIndex);
        }
    };

    return filterMethodMap[filter.type];
}

function guessFilter(keyword = '') {
    if (keyword.length === 0) return {};

    let compareString = keyword;

    if (['>', '<', '='].includes(compareString[0])) {
        compareString = keyword.slice(1);
    } else if (compareString.startsWith('!=')) {
        compareString = keyword.slice(2);
    }

    if (keyword.startsWith('>')) {
        if (compareString) {
            return {
                type: 'greaterThan',
                text: compareString.trim()
            };
        }
    }

    if (keyword.startsWith('<')) {
        if (compareString) {
            return {
                type: 'lessThan',
                text: compareString.trim()
            };
        }
    }

    if (keyword.startsWith('=')) {
        if (isNumber(compareString)) {
            return {
                type: 'equals',
                text: Number(keyword.slice(1).trim())
            };
        }
    }

    if (isNumber(compareString)) {
        return {
            type: 'containsNumber',
            text: compareString
        };
    }

    if (keyword.startsWith('!=')) {
        if (isNumber(compareString)) {
            return {
                type: 'notEquals',
                text: Number(keyword.slice(2).trim())
            };
        }
    }

    if (keyword.split(':').length === 2 && keyword.split(':').every(v => isNumber(v.trim()))) {
        compareString = keyword.split(':');
        return {
            type: 'range',
            text: compareString.map(v => v.trim())
        };
    }

    return {
        type: 'contains',
        text: compareString.toLowerCase()
    };
}