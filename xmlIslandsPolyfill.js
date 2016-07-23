var xmlDataIslandPolyfill = xmlDataIslandPolyfill || {};

xmlDataIslandPolyfill.loaded || (function () {
    document.originalGetElementById = document.getElementById;

    document.getElementById = function (id) {
        var result = document.originalGetElementById(id);
        if (!result) return result;
        if (result.nodeName === "XML") {
            if (!documents[id]) {
                var currentXmlDoc = removeXmlTagIfExists(result.outerHTML);
                documents[id] = xmlStringToDocument(currentXmlDoc); //xmlDocumentResult
                documents[id].id = id;
                if (currentXmlDoc === null) {
                    documents[id].empty = true;
                }
            }

            return documents[id];
        }
        return result;
    };

    Object.defineProperty(XMLDocument.prototype, "innerHTML", {
        get: function () {
            return this.documentElement;
        },
        set: function (newXML) {
            updateXml(this, newXML);
        }
    });

    Object.defineProperty(XMLDocument.prototype, "outerHTML", {
        get: function () {
            return this;
        },
        set: function (newXML) {
            updateXml(this, newXML);
        }
    });

    Object.defineProperty(HTMLUnknownElement.prototype, "outerHTML", {
        get: function () {
            return this;
        },
        set: function (newXML) {
            document.getElementById(this.id).outerHTML = newXML;
        }
    });

    Object.defineProperty(XMLDocument.prototype, "loadXML", {
        get: function () {
            return function (newXML) {
                updateXml(this, newXML);
            };
        }
    });

    Object.defineProperty(Element.prototype, "text", {
        get: function () {
            return this.innerHTML;
        },
        set: function (newText) {
            this.innerHTML = newText;
        }
    });

    Object.defineProperty(XMLDocument.prototype, "xml", {
        get: function () {
            return xmlDocumentToString(this);
        }
    });

    Element.prototype.selectSingleNode = function (nodeName) {
        var results = this.getElementsByTagName(nodeName);
        if (results.length !== 0) {
            return results[0];
        }

        var nodeNameLowerCase = nodeName.toLowerCase();
        results = [];

        Array.from(this.children).some((ele) => {
            if (ele.tagName.toLowerCase() === nodeNameLowerCase) {
                results.push(ele);
                return true;
            }
            return false;
        });

        if (results.length !== 0) {
            return results[0];
        }

        return null;
    };

    //Privates
    var onChangeFunctions = {};
    var documents = {};
    var domParser = new DOMParser();
    var xmlSerializer = new XMLSerializer();

    //Public API
    xmlDataIslandPolyfill.addOnChangeFunction = addOnChangeFunction;
    xmlDataIslandPolyfill.documents = documents;

    //Util functions
    function xmlDocumentToString(xmlDocument) {
        return xmlSerializer.serializeToString(xmlDocument);
    }

    function xmlStringToDocument(xmlString) {
        return domParser.parseFromString(xmlString, "text/xml");
    }

    function queryArray(selector) {
        return Array.from(document.querySelectorAll(selector));
    }

    function booleanAsNumber(bool) {
        if (bool) return -1;
        return 0;
    }

    function numberAsBoolean(number) {
        return number == -1;
    }

    //Core
    function addOnChangeFunction(xmlId, onChangeFunction, thisContext) {
        if (!onChangeFunctions[xmlId]) {
            onChangeFunctions[xmlId] = {};
        }

        if (onChangeFunctions[xmlId].onChange) {
            onChangeFunctions[xmlId].onChange.push(onChangeFunction.bind(thisContext));
        } else {
            onChangeFunctions[xmlId].onChange = [onChangeFunction.bind(thisContext)];
        }
    }

    function removeXmlTagIfExists(xmlString) {
        if (typeof(xmlString) !== 'string')
            return null;
        if (xmlString[0] !== '<')
            return null;
        if (xmlString.substr(0, 4).toLowerCase() === '<xml')
            return removeXmlTag(xmlString);
        return xmlString;
    }

    function removeXmlTag(xmlString) {
        var endOfOpenTag = xmlString.indexOf('>');
        var startOfClosingTag = xmlString.lastIndexOf('<');
        return xmlString.substr(endOfOpenTag + 1, startOfClosingTag - (endOfOpenTag + 1));
    }

    function updateXml(oldXML/*string*/, newXML) {
        if ((newXML === "") && !oldXML.empty) return;
        if (newXML === null) return;
        var id = oldXML.id;
        if (typeof newXML === "object") {
            if (!(newXML instanceof XMLDocument)) {
                newXML = xmlStringToDocument(xmlDocumentToString(newXML));
            }
            documents[oldXML.id] = newXML;
        } else {
            //todo: maybe check if result is <html> error and then no bind it
            //bad html example:
            /*<html xmlns="http://www.w3.org/1999/xhtml"><body><parsererror style="display: block; white-space: pre; border: 2px solid #c77; padding: 0 1em 0 1em; margin: 1em; background-color: #fdd; color: black"><h3>This page contains the following errors:</h3><div style="font-family:monospace;font-size:12px">error on line 1 at column 1: Extra content at the end of the document
             </div><h3>Below is a rendering of the page up to the first error.</h3></parsererror></body></html>*/
            documents[oldXML.id] = xmlStringToDocument(removeXmlTagIfExists(newXML));
        }
        if (!documents[oldXML.id]) {
            documents[oldXML.id] = oldXML;
        }

        documents[oldXML.id].id = id;
        afterXmlUpdate(documents[oldXML.id]);

        if (onChangeFunctions[id] && onChangeFunctions[id].onChange) {
            onChangeFunctions[id].onChange.forEach(function (onChangeFunc) {
                setTimeout(onChangeFunc, 0);
            });
        }

    }

    function doTableOnReadyStateChange(table, formIsland) {
        setTimeout(function () {
            eval(table.getAttribute("onreadystatechange"));
            if (!formIsland) {
                if (Array.from(xml.documentElement.children).length === 0) {
                    removeDatafldRows(table);
                }
            }
        }, 0);
    }

    function afterXmlUpdate(xml) {
        var table = getTablesOfIsland(xml)[0];

        if (checkIfIsalndHasTable(xml)) {
            if (emptyRows[getTablesOfIsland(xml)[0].id] || checkIfRowsIsland(xml)) {
                bindXmlToTable(xml, table, table.readyState !== "complete");

                if (!table.readyState || table.readyState !== "complete") {
                    table.readyState = "complete";
                    if (document.readyState === "complete") {
                        doTableOnReadyStateChange(table, xml, false);
                    } else {
                        document.addEventListener("DOMContentLoaded", function () {
                            doTableOnReadyStateChange(table, xml, false);
                        });
                    }
                }
            } else if (checkIfFormIsland(xml)) {
                bindXmlToForm(xml, table);

                if (!table.readyState || table.readyState !== "complete") {
                    table.readyState = "complete";
                    if (document.readyState === "complete") {
                        doTableOnReadyStateChange(table, xml, true);
                    } else {
                        document.addEventListener("DOMContentLoaded", function () {
                            doTableOnReadyStateChange(table, xml, true);
                        });
                    }
                }
            }
        }
    }

    var emptyRows = {};

    function getFunctionOfListenerOfType(element, xml) {
        if (element.type === "text") {
            return function () {
                xml.getElementsByTagName(this.getAttribute("datafld"))[0].innerHTML = this.value;
            }
        } else if (element.type === "checkbox") {
            return function () {
                xml.getElementsByTagName(this.getAttribute("datafld"))[0].innerHTML = booleanAsNumber(this.checked);
            }
        } else if (element.type === "select-one") {
            return function () {
                console.log(documents);
                xml.getElementsByTagName(this.getAttribute("datafld"))[0].innerHTML = Number.parseInt(this.value);
            }
        }
    }

    function setByXml(element, xml) {
        if (element.type === "text") {
            element.value = xml.getElementsByTagName(element.getAttribute("datafld"))[0].innerHTML;
        } else if (element.type === "checkbox") {
            element.checked = numberAsBoolean(xml.getElementsByTagName(element.getAttribute("datafld"))[0].innerHTML);
        } else if (element.type === "select-one") {
            element.value = xml.getElementsByTagName(element.getAttribute("datafld"))[0].innerHTML;
        }
    }

    function bindXmlToForm(xml, table) {
        var elementsToBind = Array.from(table.querySelectorAll("[datafld]"));

        elementsToBind.forEach(function (element) {
            setByXml(element, xml);
            element.updateXmlIsland = getFunctionOfListenerOfType(element, xml);
            element.addEventListener("change", element.updateXmlIsland);
        });

    }

    function bindXmlToTable(xml, table, removeEmptyDatafldLineIfXmlEmpty) {
        removeEmptyDatafldLineIfXmlEmpty = removeEmptyDatafldLineIfXmlEmpty || false;
        var rowsFromXml = Array.from(xml.documentElement.children);

        if (!emptyRows[table.id]) {
            cloneEmptyRow(table);
        }

        if (!removeEmptyDatafldLineIfXmlEmpty) {
            removeDatafldRows(table);
        } else if (rowsFromXml.length !== 0) {
            removeDatafldRows(table);
        }

        var newRows = [];

        rowsFromXml.forEach(function (rowInXml) {
            var newRow = emptyRows[table.id].cloneNode(true);
            printDataInRow(newRow, rowInXml);
            newRows.push(newRow);
        });

        function printDataInRow(newRowElement, rowInXml) {
            var datafldElements = Array.from(newRowElement.querySelectorAll("[datafld]"));
            datafldElements.forEach(function (element) {
                //todo: check if element is input instead of span
                var foundNode = rowInXml.selectSingleNode(element.getAttribute("datafld"));
                if (foundNode !== null) {
                    element.innerHTML = foundNode.innerHTML;
                }
            });
        }

        newRows.forEach(function (ele) {
            table.appendChild(ele);
        });
    }

    function getDatafldRows(table) {
        var rows = table.querySelectorAll("tr");
        return Array.from(rows).filter(function (x) {
            return x.querySelectorAll("span[datafld],input[datafld]").length > 0;
        });
    }

    function cloneEmptyRow(table) {
        var datafldRows = getDatafldRows(table);

        if (datafldRows.length !== 0) {
            emptyRows[table.id] = datafldRows[0].cloneNode(true);
        }
    }

    function removeDatafldRows(table) {
        var datafldRows = getDatafldRows(table);

        datafldRows.forEach(function (row) {
            row.parentElement.removeChild(row);
        });
    }

    function checkIfIsalndHasTable(xmlElement) {
        return getTablesOfIsland(xmlElement).length !== 0;
    }

    function getTablesOfIsland(xmlElement) {
        return queryArray("table[datasrc='#" + xmlElement.id + "']");
    }

    function getDatafldElementsOfIsland(xmlElement) {
        var tablesOfIsland = getTablesOfIsland(xmlElement);

        var spans = Array.from(tablesOfIsland[0].querySelectorAll("span[datafld]"));
        var selects = Array.from(tablesOfIsland[0].querySelectorAll("select[datafld]"));
        var inputs = Array.from(tablesOfIsland[0].querySelectorAll("input[datafld]"));

        return {spans: spans, selects: selects, inputs: inputs};
    }

    function checkIfRowsIsland(xmlElement) {
        var datafldElements = getDatafldElementsOfIsland(xmlElement);
        return (datafldElements.spans.length > 0);
    }

    function checkIfFormIsland(xmlElement) {
        var datafldElements = getDatafldElementsOfIsland(xmlElement);
        return (datafldElements.selects.length > 0 || datafldElements.inputs.length > 0);
    }

    xmlDataIslandPolyfill.loaded = true;

})();

