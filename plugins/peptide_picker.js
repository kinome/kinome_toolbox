/**
 * Peptide Picker
 * Copyright 2017 Tim Kennell Jr.
 * Licensed under the MIT License (http://opensource.org/licenses/MIT)
 **
 * Display Microarray Data in visible format for comparison of samples, 
 *     peptides, cycles, and exposures
 */

// var DIV = KINOME.addAnalysis('tims special'),
//     data = KINOME.list({level:'1.0.1'}),
//     state,
//     stateFunction = function(state) {
//         // console.log(state);
//     };

(function(exports) {
    "use strict";

    require('https://cdnjs.cloudflare.com/ajax/libs/bootstrap-slider/9.8.0/bootstrap-slider.min.js');
    require('https://cdnjs.cloudflare.com/ajax/libs/bootstrap-slider/9.8.0/css/bootstrap-slider.min.css');
    require('http://mischiefmanaged.tk/peptide_picker.css', 'css', false);

    /**
     * Function that displays peptide data at a given level
     * @param JSON data The data object for display purposes
     * @param jQuery object The div that will contain the display, assumed to be a bootstrap container with a UUID id on it
     * @param Object state The initial state of the display based on the current value of following properties: sample, peptide, cycle, exposure
     * @param Function stateFunction A callback function that takes in the current state and allows the user to see the state or use the state if desired
     */
    var display = function(data, state, stateFunction) {

        /**
         * Deep copies an object and returns it
         * @param Object object The object to deep copy
         * @return Object The deep copy of the object
         */
        var clone = function(object) {
            return {
                sample: object.sample.clone(),
                peptide: object.peptide,
                exposure: object.exposure,
                cycle: object.cycle,
                kinetic: {
                    peptide: object.peptide,
                    exposure: object.exposure
                },
                linear: {
                    peptide: object.peptide,
                    cycle: object.cycle
                }
            };
        };

        /**
         * Checks for a change in state based on a current state and a previous state
         * @param Object state The current state of the system
         * @param Object previousState The previous state of the system
         * @return Boolean Returns true if the states are different
         */
         var changedState = function(state, previousState) {
            if (state.sample.name !== previousState.sample.name
                || state.peptide !== previousState.peptide
                || state.exposure !== previousState.exposure
                || state.cycle !== previousState.cycle
            ) {
                return true;
            }

            return false;
         }

        /**
         * Define the state of the display, this will allow the display to be preset based on previous information
         * The state object
         *  * sample:  a single sample object equivalent to KINOME.get({level:'1.0.1'}).name
         *  * peptide:  the name of the peptide selected, equivalent to KINOME.get({level: '1.0.1'})[i].list('peptides').more()[j].name
         *  * cycle:  the current cycle of the state
         *  * exposure:  the current exposure level of the state
         */
        state = state || {};
        state.sample = state.sample || data[0];
        state.peptide = state.peptide || null;
        state.cycle = state.cycle || null;
        state.exposure = state.exposure || null;

        // if state function not passed, just create empty function
        stateFunction = stateFunction || function() { return };

        // Create row for picking peptide and displaying metadata
        var pageStructure = {},
            baseImgUrl = "./image/?img=",
            previousState = clone(state);
            
        pageStructure.container = $('<div id="peptide-picker-container" class="container"></div>');
        pageStructure.row = $('<div class="row"></div>').appendTo(pageStructure.container);
        pageStructure.peptidePickerCol = $('<div class="col-sm-6 col-md-5"></div>').appendTo(pageStructure.row);
        pageStructure.metaDataCol = $('<div id="metadata-col" class="col-sm-6 col-md-7 bottom-column"></div>').appendTo(pageStructure.row);
        pageStructure.cycleExposureRow = $('<div id="cycle-exposure-row" class="row"></div>').appendTo(pageStructure.metaDataCol);

        /**
         * Capitalizes the first letter of a string
         * @param String string The string to capitalize the first letter of
         * @return String The string with the first letter capitalized
         */
        var capitalize = function(string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        };

        // expecting level 1.0.1 data for now
        var displaySamples = function(data) {
            var $peptidePickerTitle = $('<h2 class="page-header">Peptide Picker</h2>').appendTo(pageStructure.peptidePickerCol),
                
                $sampleRow = $('<div class="row"></div>').appendTo(pageStructure.peptidePickerCol),
                $sampleCol = $('<div class="col-sm-6"></div>').appendTo($sampleRow),
                $searchCol = $('<div class="col-sm-6 bottom-column"></div>').appendTo($sampleRow),
                
                $sampleDropdownLabel = $('<label for="sample-dropdown">Sample: </label>').appendTo($sampleCol),
                $sampleDropdown = $('<select id="sample-dropdown" class="form-control"></select>').appendTo($sampleCol),

                $searchLabel = $('<label for="peptide-search">Peptide Search: </label>').appendTo($searchCol),
                $searchBox = $('<input type="text" id="peptide-search" class="form-control" placeholder="regexp" />').appendTo($searchCol);

            // create dropdown
            for (var i = 0; i < data.length; i++) {
                if (state && typeof state === 'object' && state.sample === data[i].name) {
                    $sampleDropdown.append('<option selected value=' + i + '>' + data[i].name + '</option>');
                
                } else {
                    $sampleDropdown.append('<option value=' + i + '>' + data[i].name + '</option>');
                }
            }

            loadPeptides(data, pageStructure.peptidePickerCol, $sampleDropdown, $searchBox);
        };

        /**
         * Searches through peptides for all matches to a given search string and changes the peptides not matched to lowered opacity
         * @param String searchString The string to match in a case-insensitive manner (regex accepted)
         * @param Array peptideList The array of peptides to search through
         */
        var peptideSearch = function(searchString, peptideList) {
            var matchedPeptideIndices = [],
                searchPattern = new RegExp(searchString, 'i'),
                peptideString;

            for (var i = 0; i < peptideList.length; i++) {
                peptideString = retrievePeptideData(peptideList[i], true);

                if (! peptideString.match(searchPattern)) {
                    peptideList[i].changeSpotOpacity(0.3);
                
                } else {
                    peptideList[i].changeSpotOpacity(1);
                }
            }
        };

        var waitForFinalEvent = (function() {
            var timers = {};
            return function(callback, ms, uniqueId) {
                if (! uniqueId) {
                    uniqueId = "Don't call this twice without a uniqueId";
                }

                if (timers[uniqueId]) {
                    clearTimeout(timers[uniqueId]);
                }
                timers[uniqueId] = setTimeout(callback, ms);
            }
        }());

        var loadPeptides = function(data, displayDiv, sampleDropdown, searchBox) {
            // Automatically display first list of peptides onload
            var currentPeptideList = data[0].list('peptides').more(),
                currentPeptideListIndex = 0;

            currentPeptideList = displayPeptides(currentPeptideList, displayDiv);

            // load in other peptide list when selected from dropdown
            sampleDropdown.change(function(e) {
                console.log('dropdown changed');
                currentPeptideListIndex = $(this).val();
                currentPeptideList = data[currentPeptideListIndex].list('peptides').more();

                // A potential change in the sample's state has occurred, call the stateFunction if there truly is one to reveal the change
                state.sample = data[currentPeptideListIndex];

                if (changedState(state, previousState)) {
                    stateFunction(clone(state));
                }

                previousState = clone(state);

                currentPeptideList = updatePeptides(currentPeptideList, displayDiv);
            });

            // resize (rebuild) peptide matrix when window is resized
            $(window).resize(function(e) {
                waitForFinalEvent(function() {
                    currentPeptideList = updatePeptides(currentPeptideList, displayDiv);
                }, 500, "bleh bleh bleh <-- unique ID :D :P");
            });


            // Attach peptide search to keypress event
            searchBox.keyup(function(e) {
                var searchString = $(this).val();
                console.log(currentPeptideList);
                peptideSearch(searchString, currentPeptideList);
            });

            return currentPeptideList;
        };

        /**
         * Calculates the maximum number of columns for a list of peptides
         * @param Array peptideList The list of peptides assumed to be in matrix format
         */
        var maxCol = function(peptideList) {
            // console.log(peptideList);
            return peptideList.reduce(function(a, b) {
                if (a.pos.spot_col > b.pos.spot_col) {
                    return a;
                }
                return b;
            }).pos.spot_col;
        };

        /**
         * Displays the peptides in a matrix (this function actually creates the HTML)
         * @param Array peptideList The list of peptides to display
         * @param jQuery Object displayDiv The div to display the matrix in
         * @param Function findPeptides A callback function that distinguishes peptides found in a search and takes the peptide list and a search string
         */
        var displayPeptides = function(peptideList, displayDiv) {
            var $peptideMatrixLabel = $('<label id="peptide-picker-label">Peptide: </label>').appendTo(displayDiv),
                $peptideDisplay = $('<div id="peptide-list"></div>').appendTo(displayDiv),
                peptideRowWidth;

            if ($peptideDisplay.is(':visible')) {
                peptideRowWidth = $peptideDisplay.width();
            
            } else {
                var parent = $('<div class="container"></div>').appendTo('body'),
                    temp = $('<div>').appendTo($('<div class="col-sm-6 col-md-5"></div>').appendTo(parent));
                    peptideRowWidth = temp.width();

                parent.remove();
            }

            var $peptideDisplayRow,
                $cell,
                spotOpacity = 1,
                previousRow = 0,
                numCol = maxCol(peptideList),
                cellDimension = peptideRowWidth / numCol,
                spotDimension = cellDimension * 0.65,
                previousPeptideClicked,
                previousCellColor,
                previousInfo;

            peptideRowWidth = peptideRowWidth - 17;

            // console.log('Peptide Row Width: ' + peptideRowWidth);
            // console.log('Column width: ' + numCol);
            // console.log('Cell Dimension: ' + cellDimension);

            for (var i = 0; i < peptideList.length; i++) {
                var currentRow = peptideList[i].pos.spot_row;

                if (currentRow !== previousRow) {
                    $peptideDisplayRow = $('<div class="row-number-' + currentRow + '"></div>').appendTo($peptideDisplay);
                }

                // Set a default color for the cells to revert to when colors are changed
                peptideList[i].defaultCellColor = '#e7e7e7';

                $cell = $('<span class="microarray-sample" style="width: ' + cellDimension +'px; height: ' + cellDimension + 'px; background-color: ' + peptideList[i].defaultCellColor + '"><button style="width: ' + spotDimension + 'px; height: ' + spotDimension + 'px;"></button></span>')
                    .appendTo($peptideDisplayRow);

                peptideList[i].cell = $cell;
                peptideList[i].changeSpotOpacity = function(opacity) {
                    // console.log(this.cell);
                    this.cell.children('button').css({opacity: opacity});
                };

                peptideList[i].changeCellColor = function(color) {
                    this.cell.css({"background-color": color});
                }

                createPopover($cell, peptideList[i]);

                if (peptideList[i].name === state.peptide) {
                    previousPeptideClicked = peptideList[i];
                    selectPeptide(peptideList[i], previousPeptideClicked, peptideList[i].defaultCellColor);
                }

                // Changes the peptide based on the one that was clicked
                (function(i) {
                    $cell.click(function(e) {
                        previousInfo = selectPeptide(peptideList[i], previousPeptideClicked, peptideList[i].defaultCellColor);

                        previousPeptideClicked = previousInfo[0];
                        previousCellColor = previousInfo[1];
                    });
                })(i);

                previousRow = currentRow;
            }

            createCycleExposureHtmlScaffold(state.sample);
            if (state.peptide === null) {
                displaySampleData(state.sample);
            }

            // Maintain state if it exists
            peptideSearch($('#peptide-search').val(), peptideList);
            return peptideList;
        };

        /**
         * Updates the peptide matrix display
         * Can be attached to events to allow display update 
         */
        var updatePeptides = function(peptideList, displayDiv) {
            $('#peptide-picker-label').remove();
            $('#peptide-list').remove();

            return displayPeptides(peptideList, displayDiv);
         };


         var selectPeptide = function(peptide, previousPeptideClicked, previousCellColor) {
            if (previousPeptideClicked !== undefined) {
                previousPeptideClicked.changeCellColor(previousCellColor);
                }

            if (previousPeptideClicked && peptide.name === previousPeptideClicked.name) {
                displaySampleData(state.sample);
                previousCellColor = peptide.defaultCellColor;
                peptide = undefined;

            } else {
                displayPeptideData(peptide);

                
                previousCellColor = peptide.cell.css("background-color");
                peptide.changeCellColor('#6c6c93');
            }

            return [peptide, previousCellColor];
         };

        /**
         * Creates dynamic popovers for each of the microarray cells
         *  * Displays name
         *  * Dynamically adjusts position based on window width
         * @param jQuery Object popoverElement The element to add the popover to
         * @param Array popoverElement The array defining the properties of the peptide
         */
        var createPopover = function(popoverElement, peptide) {
            var displayDivId = pageStructure.container.attr('id'),
                windowWidth = window.innerWidth,
                toolTipContent = peptide.name,
                $dummy = $('<div class="tooltip">' + toolTipContent + '</div>').appendTo('body'),
                toolTipWidth = $dummy.width() + 20;

            $dummy.remove();

            popoverElement.popover({
                content: peptide.name,
                placement: function(popover, cell) {
                    var cellPosition = $(cell).offset().left + $(cell).width(),
                        remainingWindow = windowWidth - cellPosition - 45;

                    // console.log('windowWidth: ' + windowWidth);
                    // console.log('cellPosition: ' + cellPosition);
                    // console.log('remainingWindow: ' + remainingWindow);
                    // console.log('toolTipWidth: ' + toolTipWidth);
                    // console.log('toolTipContent: ' + toolTipContent);

                    if (toolTipWidth > remainingWindow) {
                        return 'left';
                    }

                    return 'right';
                },
                trigger: 'hover',
                html: true
            });
        };

        var retrievePeptideData = function(peptide, string) {
            var peptideData = {
                    name: peptide.name,
                    sequence: null,
                    phosph: {
                        aminoAcid: null,
                        pos: null
                    },
                    spotConc: null,
                    uniprot: null,
                    desc: null
                },
                peptideString = peptide.name;

            // Build peptide data object assuming no order to the array
            for (var i = 0; i < peptide.length; i++) {
                if (peptide[i].key.match(/sequence/i)) {
                    peptideData.sequence = peptide[i].value;
                    peptideString += peptide[i].value;

                } else if (peptide[i].key.match(/tyr/i)) {
                    try {
                        peptideData.phosph = {
                            aminoAcid: peptide[i].key,
                            pos: JSON.parse(peptide[i].value)
                        };
                    } catch (err) {
                        // console.error(err);
                        peptideData.phosph = {
                            aminoAcid: peptide[i].key,
                            pos: peptide[i].value
                        };
                    }

                    peptideString += peptide[i].key;
                    peptideString += peptide[i].value;

                } else if (peptide[i].key.match(/spotconcentration/i)) {
                    peptideData.spotConc = peptide[i].value;
                    peptideString += peptide[i].value;

                } else if (peptide[i].key.match(/uniprotaccession/i)) {
                    peptideData.uniprot = peptide[i].value;
                    peptideString += peptide[i].value;

                } else if (peptide[i].key.match(/description/i)) {
                    peptideData.desc = peptide[i].value;
                    // peptideString += peptide[i].value;
                }
            }

            return string
                ? peptideString
                : peptideData;
        };

        var highlightPhosphAminoAcids = function(peptideData, color) {
            if (Array.isArray(peptideData.phosph.pos)) {
                var position_array = peptideData.name.split('_'),
                    position_start = position_array[position_array.length - 2],
                    sequence = peptideData.sequence.split('');

                for (var i = 0; i < peptideData.phosph.pos.length; i++) {
                    var string_position = peptideData.phosph.pos[i] - position_start;
                    sequence[string_position] = '<span style="color: ' + color + '"><strong>' + sequence[string_position] + '</strong></span>';
                }

                peptideData.sequence = sequence.join('');

            } else {
                console.warn('Phosphorylation positions are not parsible');
            }
        }

        var displaySampleData = function(sample) {
            // Update the state of the system due to change in sample
            state.peptide = null;
            if (changedState(state, previousState)) {
                stateFunction(clone(state));
            }

            previousState = clone(state);

            $('#sample-metadata').remove();
            $('#peptide-metadata').remove();

            var $dataCol = $('<div id="sample-metadata"></div>').insertAfter(pageStructure.cycleExposureRow),
                $dataColHeader = $('<h2 class="page-header">Sample Information</h2>').appendTo($dataCol),
                $infoRow = $('<div class="row"></div>').appendTo($dataCol),
                $leftCol = $('<div class="col-xs-6"></div>').appendTo($infoRow),
                $rightCol = $('<div class="col-xs-6"></div>').appendTo($infoRow),
                $currentCol;

            $('<h3>Level</h3>').appendTo($leftCol);
            $('<p>' + sample.level + '</p>').appendTo($leftCol);

            $('<h3>Barcode</h3>').appendTo($rightCol);
            $('<p>' + sample.name + '</p>').appendTo($rightCol);

            for (var i = 0; i < sample.sample_data.length; i++) {
                $currentCol = i % 2 === 0
                    ? $leftCol
                    : $rightCol;

                $('<h3>' + sample.sample_data[i].key + '</h3>').appendTo($currentCol);
                $('<p>' + sample.sample_data[i].value + '</p>').appendTo($currentCol);
            }

            $('<p class="lead alert alert-info text-center" style="margin-top: 20px">Pick a peptide to display its specific information</p>').appendTo($dataCol);
        };

        var displayPeptideData = function(peptide) {
            // Update the state of the system due to change in sample
            state.peptide = peptide.name;
            if (changedState(state, previousState)) {
                stateFunction(clone(state));
            }

            previousState = clone(state);

            createCycleExposureHtmlScaffold(state.sample);

            // remove and re-create
            $('#sample-metadata').remove();
            $('#peptide-metadata').remove();

            var peptideData = retrievePeptideData(peptide),
                $dataCol = $('<div id="peptide-metadata"></div>').insertAfter(pageStructure.cycleExposureRow),
                $dataColHeader = $('<h2 class="page-header">Peptide Information</h2>').appendTo($dataCol),
                $infoRow = $('<div class="row"></div>').appendTo($dataCol),
                $leftCol = $('<div class="col-xs-6"></div>').appendTo($infoRow),
                $rightCol = $('<div class="col-xs-6"></div>').appendTo($infoRow);

            // Fix the sequence of highlighting the phosphorylated peptides
            highlightPhosphAminoAcids(peptideData, '#ffa500');

            // Display the data
            $('<h3>Name</h3>').appendTo($leftCol);
            $('<p>' + peptideData.name + '</p>').appendTo($leftCol);

            $('<h3>Sequence</h3>').appendTo($rightCol);
            $('<p>' + peptideData.sequence + '</p>').appendTo($rightCol);

            $('<h3>Phosphorylation</h3>').appendTo($leftCol);
            $('<p>Amino Acid: ' + peptideData.phosph.aminoAcid + '</p>').appendTo($leftCol);
            $('<p>Position: ' + peptideData.phosph.pos + '</p>').appendTo($leftCol);

            $('<h3>Spot Concentration</h3>').appendTo($rightCol);
            $('<p>' + peptideData.spotConc + '</p>').appendTo($rightCol);

            $('<h3>Uniprot Accession</h3>').appendTo($leftCol);
            $('<p><a href="http://uniprot.org/uniprot/' + peptideData.uniprot + '" target="_blank">' + peptideData.uniprot + '</a></p>').appendTo($leftCol);

            $('<h3>Description</h3>').appendTo($rightCol);
            $('<p>' + peptideData.desc.replace(/\([\s\S]+$/g, '') + '</p>').appendTo($rightCol);

            createDataTable(state.sample, state.peptide, state.cycle, state.exposure).appendTo('#peptide-metadata');
        };


        /**
         * Creates the bootstrap row for the cycle and exposure sliders and then loads the sliders in
         * @param 
         */
        var createCycleExposureHtmlScaffold = function(sample) {
            pageStructure.cycleExposureRow.empty();

            var $cycleCol = $('<div class="col-sm-6"></div>').appendTo(pageStructure.cycleExposureRow),
                $exposureCol = $('<div class="col-sm-6"></div>').appendTo(pageStructure.cycleExposureRow);

            loadSlider(sample, $cycleCol, 'cycle');
            loadSlider(sample, $exposureCol, 'exposure');

            $('#peptide-metadata').append();
        };

        /**
         * Loads in either the cycle slider of the exposure slider
         * @param Object sample The sample object containing the necessary information
         * @param jQuery Object location The jQuery DOM object for where to put the slider
         * @param String type The type of slider to build (cycle | exposure)
         */
        var loadSlider = function(sample, location, type) {
            var $header = $('<h2 class="page-header">' + capitalize(type) + '</h2>').appendTo(location),
                $sliderDiv = $('<div id="' + type + '-slider" class="sliders"></div>').appendTo(location),
                $slider = $('<input type="text" />'),
                data = sample.list(type),
                dataDefault = data.length - 1; // default for cycle that is reset in the loop if using exposures

            // save the state of the slider
            for (var i = 0; i < data.length; i++) {
                if (type === 'exposure' && state[type] === null && data[i] === 50) {
                    dataDefault = i;

                } else if (state[type] !== null && state[type] === data[i]) {
                    dataDefault = i;
                }
            }

            $slider.appendTo($sliderDiv);

            // update the state and reveal if there truly is a change
            state[type] = data[dataDefault];
            if (changedState(state, previousState)) {
                stateFunction(clone(state));
            }

            previousState = clone(state);

            $slider.slider({
                value: dataDefault,
                min: 0,
                max: data.length - 1,
                tooltip_position: 'bottom',
                tooltip: 'always',
                formatter: function(value) {
                    return data[value];
                }
            }).on('slideStop', function(e) {
                state[type] = data[e.value];
                if (changedState(state, previousState)) {
                    stateFunction(clone(state));
                }
                previousState = clone(state);
                createDataTable(state.sample, state.peptide, state.cycle, state.exposure).appendTo('#peptide-metadata');
            });
        }

        /**
         * Retrieves an image link for displaying in the peptide information section
         * @param Object sample A single sample object containing all information for the selected sample
         * @param string peptide The name of the peptide that is currently selected
         * @param int cycle The currently selected cycle
         * @param int exposure The currently select exposure
         * @return Link to the image
         */
        var getImageLink = function(sample, peptide, cycle, exposure) {
            // stores the object of a peptide from a sample at a specific cycle and exposure time
            var quadfecta = sample.get({peptide: peptide, cycle: cycle, exposure: exposure})[0];

            return baseImgUrl + encodeURIComponent('"' + quadfecta.image +'"');
        }

        var createImageButton = function(imageLink) {
            return $('<button class="btn btn-lg btn-primary" onclick="window.open(\'' + imageLink + '\')">Display Image</button>');
        }

        /**
         * Creates a data table for displaying information specific to sample, peptide, cycle, and exposure
         * @param Object sample A single sample object containing all information for the selected sample
         * @param string peptide The name of the peptide that is currently selected
         * @param int cycle The currently selected cycle
         * @param int exposure The currently select exposure
         * @return jQuery Object The jquery object that represents the table
         */
        var createDataTable = function(sample, peptide, cycle, exposure) {
            $('#data-table').remove()

            // stores the object of a peptide from a sample at a specific cycle and exposure time
            var quadfecta = sample.get({peptide: peptide, cycle: cycle, exposure: exposure})[0],
                $tableContainer = $('<div id="data-table"></div>'),
                imageLink = getImageLink(sample, peptide, cycle, exposure),
                $tableTitle;

            console.log(imageLink);

            if (imageLink !== undefined && quadfecta.image !== undefined) {
                $tableTitle = $('<h3 style="display: inline; vertical-align: middle">Data</h3>&nbsp;&nbsp;&nbsp;&nbsp;<p style="display: inline;">(Image: <a href="' + imageLink + '" target="_blank">' + quadfecta.image + '</a>)</p>');
            
            } else {
                $tableTitle = $('<h3 style="display: inline; vertical-align: middle">Data</h3>');
            }

            $tableTitle.appendTo($tableContainer);
            
            var $table = $('<table class="table table-condensed"></table>').appendTo($tableContainer),
                $tableHead = $('<thead></thead>').appendTo($table),
                $tableHeaders = $('<tr><th>Measurement</th><th>Value</th></tr>').appendTo($tableHead),
                $tableBody = $('<tbody>').appendTo($table),
                $backgroundDataRow = $('<tr><td>Signal, Background</td><td>' + quadfecta.signal + ', ' + quadfecta.background + '</td></tr>').appendTo($tableBody),
                $cycleDataRow = $('<tr><td>Cycle, Exposure</td><td>' + quadfecta.cycle + ', ' + quadfecta.exposure + '</td></tr>').appendTo($tableBody);

            return $tableContainer;
        };

        displaySamples(data, state);
        return pageStructure.container;
    };

    exports.peptidePicker = display;

}(KINOME));
