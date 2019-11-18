// ==UserScript==
// @name       Relluassari
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Relluassari auttaa relaatioiden ratkonnassa hakemalla valittuja sanoja eri lähteistä ja testaamalla näitä relaatioon puoliautomaattisesti
// @author       mrummuka@hotmail.com
// @include      https://hyotynen.iki.fi/relaatiot/pelaa/
// @connect      fi.wikipedia.org
// @connect      fi.wiktionary.org
// @connect      www.bing.com
// @connect      www.bing.fi 
// @connect      www.ratkojat.fi
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_xmlhttpRequest
// @grant       GM_registerMenuCommand
// @grant       GM_openInTab
// ==/UserScript==

/*-- GM_registerMenuCommand (menuName, callbackFunction, accessKey)
 */
GM_registerMenuCommand("Suorita lähdehaku (teemasana)", fetchFullText, "F");
GM_registerMenuCommand("Parsi hakutulos sanoiksi", generateWordArray, "G");
GM_registerMenuCommand("Bruteta sanalista", testallwords, "T");
GM_registerMenuCommand("Suorita lähdehaku (oma sana)", debugreadcustomword, "C");
GM_registerMenuCommand("(DEBUG) Print search results", debugprintFullText, "P");
GM_registerMenuCommand("(DEBUG) Print parsed words", debugprintWords);
GM_registerMenuCommand("(DEBUG) Syötä hakutulos käsin", debugreadcustomfulltext);
GM_registerMenuCommand("Wikipedia haku päälle/pois", toggleWikipediaSearch);
GM_registerMenuCommand("Bing haku päälle/pois", toggleBingSearch);
GM_registerMenuCommand("Wiktionary haku päälle/pois", toggleWiktionarySearch);
GM_registerMenuCommand("Ratkojat haku päälle/pois", toggleRatkojatSearch);
GM_registerMenuCommand("Help", showHelpUsage);

// Script currently uses the following Global GM variables:
// --
// 1. for full text storage
// wikitext - JSONified string (fulltext from matching Wikipedia page)
// bingtext - JSONified string (fulltext of BING search results)
// wikttext - JSONified string (fulltext of matching Wiktionary search result)
// ratktext - JSONified string (fulltext of matchin ratkojat search result)
// 2. for words storage
// rellusana - JSONified words array 
// 3. for setting search sources on/off
// searchWikipedia - boolean indicating if wikipedia search is on/off
// searchBing - boolean indicating if wikipedia search is on/off
// searchWiktionary - boolean indicating if wikipedia search is on/off
// searchRatkojat - boolean indicating if wikipedia search is on/off

function showHelpUsage() {
    let helpString = "Hei, olen Relluassari! Yritän auttaa sinua relaatioiden ratkonnassa ;) \n" +
        "<<< Koska olen vielä beta, älä pahastu jos en osaa jotain, tai kaadun kesken kaiken >>> \n" +
        " \n Miten kutsua minut apuun? \n " +
        " TL;DR? Klikkaa tunnettua -> klikkaa tuntematonta -> klikkaa tuntematonta -> ... -> Repeat \n" +
        " \nEli miten? \n" +
        " 1) Klikkaa graafista tunnettua sanaa \n" +
        "   -> Relluassari tekee Wikipediasta, Bingistä, Wiktionarystä ja Ratkojista lähdehaut ko. sanalla. \n" +
        " 2) Kun haku valmis, klikkaa graafista tunnettuun kytkettyä tuntematonta sanaa \n" +
        "   -> Relluassari parsii hakutuloksista klikatun pituiset sanat ja brutettaa rellua niillä. \n" +
        " 3) Kun brutetus valmis, klikkaa seuraavaa tunnettuun kytkettyä tuntematonta \n" +
        "   -> Relluassari parsii hakutuloksista klikatun pituiset sanat ja brutettaa rellua niillä. \n" +
        " 4) Valitse uusi tunnettu sana lähteeksi ja siirry kohtaan 1) \n" +
        "\nAdvanced usage: \n" +
        "  Menu>Suorita lähdehaku (teemasana) - tekee lähdehaun vain teemasanalla \n" +
        "  Menu>Suorita lähdehaku (oma sana)  - tekee lähdehaun syöttämälläsi sanalla/sanoilla (esim. usean sanan hakuun Bingistä) \n" +
        "  Menu>Parsi hakutulos sanoiksi - parsii hakutuloksesta *kaikkien* näkyvien tuntemattomien pituiset sanat \n" +
        "  Menu>Bruteta sanalista - brutettaa rellua sen hetken muistissa olevalla koko sanalistalla \n";
    alert(helpString);
}


function toggleWikipediaSearch() {
    let searchWikipedia = GM_getValue("searchWikipedia", true);
    if (searchWikipedia == true) {
        console.log("Search from Wikipedia:off");
        GM_setValue("searchWikipedia", false);
    } else {
        console.log("Search from Wikipedia:on");
        GM_setValue("searchWikipedia", true);
    }
}

function toggleBingSearch() {
    let searchBing = GM_getValue("searchBing", true);
    if (searchBing == true) {
        console.log("Search from Bing:off");
        GM_setValue("searchBing", false);
    } else {
        console.log("Search from Bing:on");
        GM_setValue("searchBing", true);
    }
}

function toggleWiktionarySearch() {
    let searchWiktionary = GM_getValue("searchWiktionary", true);
    if (searchWiktionary == true) {
        console.log("Search from Wiktionary:off");
        GM_setValue("searchWiktionary", false);
    } else {
        console.log("Search from Wiktionary:on");
        GM_setValue("searchWiktionary", true);
    }
}

function toggleRatkojatSearch() {
    let searchRatkojat = GM_getValue("searchRatkojat", true);
    if (searchRatkojat == true) {
        console.log("Search from Ratkojat:off");
        GM_setValue("searchRatkojat", false);
    } else {
        console.log("Search from Ratkojat:on");
        GM_setValue("searchRatkojat", true);
    }
}


// prints all words currently in array (for debugging)
function debugprintFullText() {
    let wikitext = GM_getValue("wikitext", false);

    if (wikitext === false) {
        console.warn("No fulltext for Wikipedia stored - fetch one first!");
    } else {
        console.debug("Wikipedia: " + wikitext);
    }

    let bingtext = GM_getValue("bingtext", false);

    if (bingtext === false) {
        console.warn("No fulltext for Bing stored - fetch one first!");
    } else {
        console.debug("Bing: " + bingtext);
    }

    let wikttext = GM_getValue("wikttext", false);

    if (wikttext === false) {
        console.warn("No fulltext for Wiktionary stored - fetch one first!");
    } else {
        console.debug("Wiktionary: " + wikttext);
    }

    let ratktext = GM_getValue("ratktext", false);

    if (ratktext === false) {
        console.warn("No fulltext for Ratkojat stored - fetch one first!");
    } else {
        console.debug("Ratkojat: " + ratktext);
    }

}


// prints all words currently in array (for debugging)
function debugprintWords() {
    let wordslist = GM_getValue("rellusana", false);

    if (wordslist === false) {
        console.error("No wordslists stored - generate one first!");
        return;
    }

    console.log(wordslist[0] + " => " + wordslist.length + " : " + JSON.stringify(wordslist.slice(1, wordslist.length)));
}

// trim strings in an array
function strim(s) {
    return s.trim()
}
// convert strings to lowercase in an array
function slowercase(s) {
    return s.toLowerCase()
}


// wrapper for generateWordArray for menu item
// executes word array generation for all visible unknown word lengths
function generateWordArray() {
    return generateWordArrayfor(getTuntematonLengths());
}

// loads current full text from global variable and parses it extracting words & multi-word combinations matching lengths of unknown word(s) passed in parameter
// @param uwlengths - array of arrays where parent array element = different word (id) and child element = different word in multi word expressions with same id
// @input GM global "wikitext"
// @output GM global "rellusana"
// @return same data that was stored to global "rellusana"

// TODO : perhaps parameterize also which "fulltext" to use so that the calling function will always decide this
async function generateWordArrayfor(uwlengths) {
    let wikitext = GM_getValue("wikitext", " "); // wikipedia
    let bingtext = GM_getValue("bingtext", " "); // bing
    let wikttext = GM_getValue("wikttext", " "); // wiktionary
    let ratktext = GM_getValue("ratktext", " "); // ratkojat

    if (wikitext === " " && bingtext === " " && wikttext === " " && ratktext === " ") {
        console.warn("No fulltext stored - fetch one first!");
        return;
    }
    // TODO: instead of importing all at once, run three times with different inputs (and calculates statistics)
    let fulltext = wikitext + " " + bingtext + " " + wikttext + " " + ratktext;

    console.log("Selecting words by extracting " + JSON.stringify(uwlengths) + " length words from fulltext");
    // array for all regexp expressions matching tuntematon length words (and multi-word "words")
    let reArr = new Array();

    for (let i = 0; i < uwlengths.length; i++) {
        // for each ID generate own regexp that matches words of that length
        // TODO: replace starting separator with (?:[^a-zåäö0-9]+) 
        // TODO replace ending separator with (?:[^a-zåäö0-9]+)
        let reStr = "(?:[^a-zåäö0-9]+)"
        for (let j = 0; j < uwlengths[i].length; j++) {
            reStr = reStr + "[a-z0-9]{" + uwlengths[i][j] + "}[ ]"
        }
        reStr.replace((reStr.length - 1), "(?:[^a-zåäö0-9]+)");
        reArr.push(new RegExp(reStr, "gi"));
    }
    let wordslist = new Array();
    for (let n = 0; n < reArr.length; n++) {
        // RE returns (currently) word matches with whitespaces in beginning & at end
        let wmatcheswws = fulltext.match(reArr[n]);
        if (wmatcheswws != null) {
            // convert to lowercase, and trim beginning/trailing whitespace away
            let wmatches = wmatcheswws.map(slowercase).map(strim);
            // remove duplicates
            let uniquelist = Array.from(new Set(wmatches));
            console.debug(JSON.stringify(uniquelist.length + " matches for " + uwlengths[n]));
            //console.log( "<= " + JSON.stringify( uniquelist ) );
            wordslist = wordslist.concat(uniquelist);
        }
    }

    // make array unique
    let uniquewords = Array.from(new Set(wordslist));
    console.log("Total " + uniquewords.length + " words matched");

    if (GM_getValue("lemmatizeWords", false) == true) {
        console.log("Lemmatization is on")
        // convert words to base form
        let bases = [];
        for (let i = 0; i < uniquewords.length; i++) {
            let baseformArr = await convertToBaseForm(uniquewords[i]);
            console.debug("Converted " + uniquewords[i] + " into " + JSON.stringify(baseformArr));
            bases = bases.concat(baseformArr);
        }
        console.debug("n:" + JSON.stringify(bases))

        // again deduplicate
        let uniques = Array.from(new Set(bases));
        uniquewords = uniques;
    }

    GM_setValue("rellusana", uniquewords);
    return uniquewords;
}


// returns all words with length = nchar from myarray array
// @input myarray - array of strings
// @nchar number - length filter
// @return array containing only strings with nchar length
function ncharWords(myarray, nchar) {
    //TODO: check inputs
    return myarray.filter(word => word.length == nchar);
}

// Form autosubmitter for words obtained from full text parsing
// Iterates through the whole stored words list
// (presumes the words have been just filtered to match visible unknown word lengths
// @input GM global "rellusana"
// @return NA
// TODO: I think page reloads caused by correct words matching to adjacent screens stop execution
function testallwords() {
    let wordslist = GM_getValue("rellusana", false);

    if (wordslist === false) {
        throw new Error("No wordslists stored - extract one first!");
    }
    console.log("Testing " + wordslist.length + " words");

    for (let i = 1; i < wordslist.length; i++) {
        console.debug("Trying " + wordslist[i]);
        document.arvaukset.arvaus.value = wordslist[i];
        document.arvaukset.onsubmit();
    }
    console.log("Testing all words done.");
    setmouseactions();
}

// Parses teemasana from document
// @return teemasana
function getTeemaSana() {
    // presumes only one teemasana exists and is visible
    let teemasana = document.getElementsByClassName("teema sana")[0].innerText
    if (teemasana == undefined || teemasana == null) {
        throw new Error("Teemasana not found");
    }
    return teemasana;
}

// register both mouse listeners with one menu item
// TODO: register automatically with every page (re)load
function setmouseactions() {
    setTuntematonMouseAction();
    setTunnetutMouseAction();
    setTeemaMouseAction();
    //TODO: "vihje sana" class + newly exposed missing
}

// courtesy of http://www.howtocreate.co.uk/referencedvariables.html
function mouseClickActScopePreserver(param) {
    return function () {
        // RE to extract word lengths
        let re = /[0-9]+/g

        console.debug("Clicked " + param.id);
        //console.debug( JSON.stringify(s) );
        setmouseactions();

        //TODO: add "vihje sana" class (tuntematon)

        let clickednode = document.getElementById(param.id);
        if (clickednode.className == "teema sana") {
            console.log("Clicked teemasana");
            // do teemasana default action e.g. fetch all fulltext
            fetchFullTextfor(clickednode.innerText);
        } else if (clickednode.className == "tuntematon sana" || clickednode.className == "fade-in tuntematon sana" || clickednode.className == "tuntematon vinkki sana") {
            console.log("Clicked tuntematon sana");
            let wordlens = clickednode.innerText.match(re);
            // convert string array to number array
            let nums = wordlens.map(Number);
            let numArr = new Array(nums);

            // tuntematon default = extract and test
            generateWordArrayfor(numArr);

            testallwords();

            // todo debug by printing content from both methods and compare if second is execd after first
            // if not async or something else
            // TODO: make it to complete this later
        } else if (clickednode.className == "tunnettu sana" || clickednode.className == "fade-in tunnettu sana" ||
            clickednode.className == "tunnettu sana vinkki" || clickednode.className == "tunnettu vinkki sana") {
            console.log("Clicked tunnettu sana");
            //tunnettu default = fetch fulltext
            fetchFullTextfor(clickednode.innerText);
        } else {
            console.log("Clicked not supported element (background?)");
        }
    };
}

// Adds mouse click listener for unknown words
function setTuntematonMouseAction() {
    let tuntemattomat = document.getElementsByClassName("tuntematon sana");
    if (tuntemattomat != undefined && tuntemattomat != null && tuntemattomat.length > 0) {
        for (let el of tuntemattomat) {
            el.onclick = mouseClickActScopePreserver(el);
        }
    }
    // for fade-in words that are expanded as game goes on
    let tuntemattomat2 = document.getElementsByClassName("fade-in tuntematon sana");
    if (tuntemattomat2 != undefined && tuntemattomat2 != null && tuntemattomat2.length > 0) {
        for (let el of tuntemattomat2) {
            el.onclick = mouseClickActScopePreserver(el);
        }
    }

    // for vinkki sana words that are expanded as game goes on
    let tuntemattomat3 = document.getElementsByClassName("tuntematon vinkki sana");
    if (tuntemattomat3 != undefined && tuntemattomat3 != null && tuntemattomat3.length > 0) {
        for (let el of tuntemattomat3) {
            el.onclick = mouseClickActScopePreserver(el);
        }
    }
}

// Adds mouse click listener to all known word boxes that
// fetches the fulltext from wikipedia for that word when clicked
function setPelikenttaMouseAction() {
    let kentta = document.getElementById("pelikentta");
    kentta.onclick = mouseClickActScopePreserver(kentta);
    return true;
}

// Adds mouse click listener to all known word boxes that
// fetches the fulltext from wikipedia for that word when clicked
function setTeemaMouseAction() {
    let teema = document.getElementsByClassName("teema sana");
    if (teema != undefined && teema != null && teema.length > 0) {
        for (let el of teema) {
            el.onclick = mouseClickActScopePreserver(el);
        }
    } else {
        console.log("Ei teemasanaa??");
    }
    return true;
}

// Adds mouse click listener to all 'known word' boxes 
function setTunnetutMouseAction() {
    let tunnetut = document.getElementsByClassName("tunnettu sana");
    if (tunnetut != undefined && tunnetut != null && tunnetut.length > 0) {
        for (let el of tunnetut) {
            el.onclick = mouseClickActScopePreserver(el);
        }
    }

    let tunnetut2 = document.getElementsByClassName("tunnettu sana vinkki");
    if (tunnetut2 != undefined && tunnetut2 != null && tunnetut2.length > 0) {
        for (let el of tunnetut2) {
            el.onclick = mouseClickActScopePreserver(el);
        }
    }

    let tunnetut4 = document.getElementsByClassName("tunnettu vinkki sana");
    if (tunnetut4 != undefined && tunnetut4 != null && tunnetut4.length > 0) {
        for (let el of tunnetut4) {
            el.onclick = mouseClickActScopePreserver(el);
        }
    }

    let tunnetut3 = document.getElementsByClassName("fade-in tunnettu sana");
    if (tunnetut3 != undefined && tunnetut3 != null && tunnetut3.length > 0) {
        for (let el of tunnetut3) {
            el.onclick = mouseClickActScopePreserver(el);
        }
    }

    return true;
}

// Parses currently visible unknown word lengths
// @return array of arrays, with word lengths, where
// .. each parent array element corrensponds to different tuntematon sana (different id)
// .. and each child array element(s) correspond to length of each word within that id
// e.g.
// the following data
// <div id="s14" class="tuntematon sana" style="left:400; top:305;">....... (7)</div>
// <div id="s15" class="tuntematon sana" style="left:410; top:365;">..... (5) ..... (5)</div>
// would produce [ [7] , [5,5] ]
function getTuntematonLengths() {
    // RE to extract word lengths
    let re = /[0-9]+/g

    let tuntematonA = new Array();
    // get unknown words
    let tuntematonO = document.getElementsByClassName("tuntematon sana")
    for (let item of tuntematonO) {
        // parse matches to text array
        let wordlen = item.textContent.match(re)
        // convert string array to number array
        let nums = wordlen.map(Number)
        tuntematonA.push(nums)
    }
    return tuntematonA;
}

function stripText(text) {
    if (text == undefined || text == null || typeof (text) != "string") {
        throw new Error("Invalid input! Expected string, got " + JSON.stringify(text))
    }
    // hard-coded ignore of wikimedia pages not found // TODO: find a better way 
    if (text.includes("Wikimedia Error")) {
        return "";
    }

    //  	"\u2013" should be removed, too
    // TODO: whole regexp thingy should be reversed so that only alphanumerics are accepted and all others cleared
    const ere = {
        brackets: /\[|\]|\{|\}/gi,
        equalsetc: /=|\'|\"|\|/gi,
        othershit: /\/|\\|\(|\)|\!|\?|-/gi,
        ln: /\n/gi,
        dotorcommaorsemi: /\.|\,|\;|\:/gi,
        multispace: /[ ]{2,}/g
    }

    // strip wiki [] syntax + . + \n + header + footer away
    let stripped = text.replace(ere.brackets, ' ')
        .replace(ere.equalsetc, ' ')
        .replace(ere.othershit, ' ')
        .replace(ere.dotorcommaorsemi, ' ')
        .replace(ere.ln, ' ')
        .replace(ere.multispace, ' ');

    return stripped;
}


// Wrapper for menu item (to run full-text search for teemasana
// TODO: add search to mouse press on teemasana object
function fetchFullText() {
    return fetchFullTextfor(getTeemaSana());
}


// Fetches Wikipedia full page from wikipedia (using param ?action=raw) + all other sources
// sana - string containing word that resolves to full page via wikipedia query
// @returns - NA
// @stores - GM global "wikitext"
function fetchFullTextfor(sana) {

    if (GM_getValue("searchWikipedia", true) == true) {
        console.debug("Starting direct wiki query for " + sana);
        let wikiurl = encodeURI('https://fi.wikipedia.org/wiki/' + sana + "?action=raw");

        GM_xmlhttpRequest({
            method: "GET",
            url: wikiurl,
            onload: function (response) {
                let fulltext = response.responseText;
                // TODO: how to store what sana the results are for ? previously: teema sana as first array element
                // wordslist.unshift( getTeemaSana() );
                let sanitized = stripText(fulltext);
                GM_setValue("wikitext", sanitized);
                console.log("Fetched " + fulltext.length + " chars for " + sana + " from wikipedia");
                console.log("Stored " + sanitized.length + " chars for " + sana + " from wikipedia");
            },
            onerror: function (response) {
                console.error("Error " + response.statusText + " retrieving " + sana + " from " + wikiurl)
            }
        });
    } else {
        GM_setValue("wikitext", "");
    }

    if (GM_getValue("searchBing", true) == true) {
        console.debug("Starting Bing query for " + sana);
        let bingurl = encodeURI('https://www.bing.com/search?count=100&q=language:fi+' + sana);

        GM_xmlhttpRequest({
            method: "GET",
            url: bingurl,
            onload: function (response) {
                let htmltext = response.responseText;
                console.debug("Fetched " + htmltext.length + " chars for " + sana + " from Bing");
                let fulltext = parseSearchEngResults(htmltext);
                console.debug("Parsed " + fulltext.length + " chars for " + sana + " from html");
                let sanitized = stripText(fulltext);
                GM_setValue("bingtext", sanitized);
                console.log("Stored " + sanitized.length + " chars for " + sana + " from Bing");
            },
            onerror: function (response) {
                console.error("Error " + response.statusText + " retrieving " + sana + " from " + bingurl)
            }
        });
    } else {
        GM_setValue("bingtext", "");
    }

    if (GM_getValue("searchWiktionary", true) == true) {
        console.debug("Starting wikisanakirja query for " + sana);
        let wikisanakirjaurl = encodeURI('https://fi.wiktionary.org/wiki/' + sana.toLowerCase() + "?action=raw");

        GM_xmlhttpRequest({
            method: "GET",
            url: wikisanakirjaurl,
            onload: function (response) {
                let fulltext = response.responseText;
                // TODO: how to store what sana the results are for ? previously: teema sana as first array element
                // wordslist.unshift( getTeemaSana() );
                let sanitized = stripText(fulltext);
                GM_setValue("wikttext", sanitized);
                console.log("Fetched " + fulltext.length + " chars for " + sana + " from wikisanakirja");
                console.log("Stored " + sanitized.length + " chars for " + sana + " from wikisanakirja");
            },
            onerror: function (response) {
                console.error("Error " + response.statusText + " retrieving " + sana + " from " + wikisanakirjaurl)
            }
        });
    } else {
        GM_setValue("wikttext", "");
    }

    if (GM_getValue("searchRatkojat", true) == true) {
        console.debug("Starting ratkojat query for " + sana);
        let ratkojaturl = encodeURI('https://www.ratkojat.fi/hae?s=' + sana.toLowerCase() + '&mode=2');

        GM_xmlhttpRequest({
            method: "GET",
            url: ratkojaturl,
            onload: function (response) {
                let htmltext = response.responseText;
                console.debug("Fetched " + htmltext.length + " chars for " + sana + " from ratkojat");
                let fulltext = parseSearchEngResults2(htmltext);
                console.debug("Parsed " + fulltext.length + " chars for " + sana + " from html2");
                let sanitized = stripText(fulltext);
                GM_setValue("ratktext", sanitized);
                console.log("Stored " + sanitized.length + " chars for " + sana + " from ratkojat");
            },
            onerror: function (response) {
                console.error("Error " + response.statusText + " retrieving " + sana + " from " + ratkojaturl)
            }
        });
    } else {
        GM_setValue("ratktext", "");
    }

}
// Parses html extracting only relevant text elements from BING query results
function parseSearchEngResults(htmlres) {
    let el = document.createElement('html');
    el.innerHTML = htmlres;
    let searchResultCollection = el.getElementsByClassName('b_caption');
    let resstr = " ";
    for (let item of searchResultCollection) {
        console.debug("BING results: " + item.innerText);
        resstr += item.innerText;
        resstr += " ";
    }
    return resstr;
}

// Parse HTML extracting only relevant text results from ratkojat query
function parseSearchEngResults2(htmlres) {
    let el = document.createElement('html');
    el.innerHTML = htmlres;
    let searchResultCollection = el.getElementsByClassName('w wi');
    let resstr = " ";
    for (let item of searchResultCollection) {
        console.debug("Ratkojat results: " + item.innerText);
        resstr += item.innerText;
        resstr += " ";
    }
    return resstr;
}

function debugreadcustomword() {
    let message = "Syötä haluamasi sana/sanakombinaatio, jolla tehdä haku"
    let userwords = window.prompt(message);
    console.debug("User entered: " + userwords);
    fetchFullTextfor(userwords);
    generateWordArray();
}

function debugreadcustomfulltext() {
    let message = "(Manual override) - Syötä haluamasi fulltext"
    let userfulltext = window.prompt(message);
    console.debug("User entered fulltext: " + userfulltext);
    let sanitized = stripText(userfulltext);
    GM_setValue("wikitext", "");
    GM_setValue("ratktext", "");
    GM_setValue("wikttext", "");
    GM_setValue("bingtext", sanitized);
}

(function () {
    'use strict'

    setmouseactions();

    window.addEventListener('load', function () {
        setmouseactions();
    });

}())
