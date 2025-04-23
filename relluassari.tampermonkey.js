// ==UserScript==
// @name       Relluassari 🤖
// @namespace    http://tampermonkey.net/
// @version      0.47
// @description  Relluassari 🤖 - auttaa relaatioiden ratkonnassa hakemalla valittuja sanoja eri lähteistä ja testaamalla näitä relaatioon puoliautomaattisesti
// @author       mrummuka@hotmail.com
// @include      https://hyotynen.iki.fi/relaatiot/pelaa/
// @connect      fi.wikipedia.org
// @connect      fi.wiktionary.org
// @connect      www.bing.com
// @connect      www.bing.fi
// @connect      www.ratkojat.fi
// @connect      www.synonyymit.fi
// @resource     JSPANELCSS https://cdn.jsdelivr.net/npm/jspanel4@4.15.0/dist/jspanel.css
// @require      https://cdn.jsdelivr.net/npm/jspanel4@4.15.0/dist/jspanel.js
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_xmlhttpRequest
// @grant       GM_registerMenuCommand
// @grant       GM_openInTab
// @grant       GM_addStyle
// @grant       GM_getResourceText
// ==/UserScript== 

/* // @require      https://cdn.jsdelivr.net/npm/@trim21/gm-fetch@0.4.0 */

/* TODO: test https://unpkg.com/languagedetect@2.0.0/lib/LanguageDetect.js 
to identify and exclude english words from the list
*/

/*-- GM_registerMenuCommand (menuName, callbackFunction, accessKey)
 */
GM_registerMenuCommand("Suorita lähdehaku (teemasana)", fetchFullText, "F");
GM_registerMenuCommand("Parsi hakutulos sanoiksi", generateWordArray, "G");
GM_registerMenuCommand("Bruteta sanalista", testallwords, "T");
GM_registerMenuCommand("Suorita lähdehaku (oma sana)", debugreadcustomword, "C");
GM_registerMenuCommand("(DEBUG) Print search results", debugprintFullText, "P");
GM_registerMenuCommand("(DEBUG) Print parsed words", debugprintWords);
GM_registerMenuCommand("(DEBUG) Syötä hakutulos käsin", debugreadcustomfulltext);
GM_registerMenuCommand("(TEST) jspanel", createPanels);
GM_registerMenuCommand("Wikipedia haku päälle/pois", toggleWikipediaSearch);
GM_registerMenuCommand("Bing haku päälle/pois", toggleBingSearch);
GM_registerMenuCommand("Wiktionary haku päälle/pois", toggleWiktionarySearch);
GM_registerMenuCommand("Ratkojat haku päälle/pois", toggleRatkojatSearch);
GM_registerMenuCommand("Synonyymit haku päälle/pois", toggleSynonyymitSearch);
GM_registerMenuCommand("DEBUG päälle/pois", toggleDEBUG);
GM_registerMenuCommand("Help", showHelpUsage);

let jspanel_bing = null, jspanel_wiki = null, jspanel_wikt = null, jspanel_ratk = null, jspanel_syno = null;
let DEBUG=GM_getValue("DEBUG", false);

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
        setSrcLoadVisToNA("wiki");
    } else {
        console.log("Search from Wikipedia:on");
        GM_setValue("searchWikipedia", true);
        setSrcLoadVisToEmpty("wiki");
    }
}

function toggleBingSearch() {
    let searchBing = GM_getValue("searchBing", true);
    if (searchBing == true) {
        console.log("Search from Bing:off");
        GM_setValue("searchBing", false);
        setSrcLoadVisToNA("bing");
    } else {
        console.log("Search from Bing:on");
        GM_setValue("searchBing", true);
        setSrcLoadVisToEmpty("bing");
    }
}

function toggleWiktionarySearch() {
    let searchWiktionary = GM_getValue("searchWiktionary", true);
    if (searchWiktionary == true) {
        console.log("Search from Wiktionary:off");
        GM_setValue("searchWiktionary", false);
        setSrcLoadVisToNA("wikt");
    } else {
        console.log("Search from Wiktionary:on");
        GM_setValue("searchWiktionary", true);
        setSrcLoadVisToEmpty("wikt");
    }
}

function toggleRatkojatSearch() {
    let searchRatkojat = GM_getValue("searchRatkojat", true);
    if (searchRatkojat == true) {
        console.log("Search from Ratkojat:off");
        GM_setValue("searchRatkojat", false);
        setSrcLoadVisToNA("ratk");
    } else {
        console.log("Search from Ratkojat:on");
        GM_setValue("searchRatkojat", true);
        setSrcLoadVisToEmpty("ratk");
    }
}

function toggleSynonyymitSearch() {
    let searchSynonyymit = GM_getValue("searchSynonyymit", true);
    if (searchSynonyymit == true) {
        console.log("Search from Synonyymit:off");
        GM_setValue("searchSynonyymit", false);
    } else {
        console.log("Search from Synonyymit:on");
        GM_setValue("searchSynonyymit", true);
        setSrcLoadVisToEmpty("syno");
    }
}

function toggleDEBUG() {
    let debug = GM_getValue("DEBUG", true);
    if (debug == true) {
        console.log("DEBUG:off");
        GM_setValue("DEBUG", false);
        DEBUG=false;
        jspanel_bing ? jspanel_bing.close() : null;
        jspanel_wiki ? jspanel_wiki.close() : null;
        jspanel_wikt ? jspanel_wikt.close() : null;     
        jspanel_ratk ? jspanel_ratk.close() : null;
        jspanel_syno ? jspanel_syno.close() : null;

        
    } else {
        console.log("DEBUG:on");
        GM_setValue("DEBUG", true);
        DEBUG=true;
        createPanels();
    }
}

// create one panel (title = header title)
function createPanel(title) {
    return jsPanel.create({
            theme: 'dark',
            position: { my: 'left-bottom', at:'left-bottom', autoposition: "right"  },
            footerToolbar: '<span class="flex flex-grow">retrieed words</span>',
            panelSize: {
                width: () => { return Math.min(250);},
                height: () => { return Math.min(200, window.innerHeight*0.6);}
            },
            content: '<p>Words will be loaded here\n</p>',
            headerTitle: title,
            container: "footer" // test
        });
}

// create all panels 
function createPanels() {
    if( jspanel_wiki == undefined || jspanel_wiki == null ) 
        jspanel_wiki = createPanel("Wiki");
    if( jspanel_bing == undefined || jspanel_bing == null )
        jspanel_bing = createPanel("Bing");
    if( jspanel_ratk == undefined || jspanel_ratk == null )
        jspanel_ratk = createPanel("Ratkojat");
    if( jspanel_syno == undefined || jspanel_syno == null )
        jspanel_syno = createPanel("Synonyymit");
    if( jspanel_wikt == undefined || jspanel_wikt == null )
        jspanel_wikt = createPanel("Wiktionary");
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

    let synotext = GM_getValue("synotext", false);

    if (synotext === false) {
        console.warn("No fulltext for Synonyymit stored - fetch one first!");
    } else {
        console.debug("Synonyymit: " + synotext);
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

function ignoreWord(s) {
    const ignoreWords = [
        "että", "jotta", "koska", "kun", "jos", "vaikka", "kuin", "kunnes",
        "ja", "sekä", "sekä että", "niin",
        "tai", "vai", "joko", "eli",
        "sillä", "mutta", "paitsi", "vaan",
        "alkaen", "mennessä", "asti", "saakka", "viimeistään",
        "totta puhuen", "huomioon ottaen", "mukaan lukien",
        "koskien", "liittyen", "sisältyen",
        "takana", "alla", "päällä", "yllä", "vieressä", "sivulla", "luo", "luokse", "vasten",
        "vuoksi", "sijaan",
        "jollei", "ellei", "mikäli", "josko", "asemesta",
        "minä", "sinä", "hän", "me", "te", "he",
        "eräs", "se", "joka", "mikä", "joku", "jokin", "kuka", "ketä", "ketkä", "kukin",
        "kumpikin", "molemmat", "moni", "monta", "montaa", "muutama",
        "https", "http", "index", "width", "class", "tools", "night", "theme", "title",
        "match", "split", "modal", "wikipedia", "model", "false", "true",
        "wgbreakframes", "wgpopupsflags", "wgulsposition", "interlanguage", "rlpagemodules" 
        ]
    return ignoreWords.includes(s);
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
// TODO: instead of merge all to one list, process in a loop, one by one, and store to array => and visualize to panels
// only at the end join
// consider splitting to smaller functions

//TODO: breaks flwo

function generateWordArrayforX(uwlengths, source) {
    console.log("Generating word array for " + JSON.stringify(uwlengths) + " from " + source);
    let fulltext = GM_getValue(source, " "); // wikipedia

    if (fulltext === " ") {
        console.warn("No fulltext stored for " + source + " - fetch one first!");
        return [];
    }

    console.log("Selecting words by extracting " + JSON.stringify(uwlengths) + " length words from fulltext");
    // array for all regexp expressions matching tuntematon length words (and multi-word "words")
    let reArr = new Array();

    for (let i = 0; i < uwlengths.length; i++) {
        // for each ID generate own regexp that matches words of that length
        // TODO: replace starting separator with (?:[^a-zåäö0-9]+)
        // TODO replace ending separator with (?:[^a-zåäö0-9]+)

        // (?:\b|^)[a-zA-ZåäöÅÄÖ]{4}\b <- this is what we are after
        // (?:\b|^)[a-zA-ZåäöÅÄÖ]{4}\b)[a-zA-ZåäöÅÄÖ]{2} <- or this, if there are multiple numbers like (4),(2)
        let reStr = "(?:\\s|^)";
        for (let j = 0; j < uwlengths[i].length; j++) {
            reStr = reStr + "[a-zA-ZåäöÅÄÖ]{" + uwlengths[i][j] + "}(?:\\s|$)"
        }
        reArr.push(new RegExp(reStr, "gi"));
        
        /*
        let reStr = "(?:[^a-zåäö0-9]+)"
        for (let j = 0; j < uwlengths[i].length; j++) {
            reStr = reStr + "[a-z0-9]{" + uwlengths[i][j] + "}[ ]"
        }
        reStr = reStr.replace((reStr.length - 1), "(?:[^a-zåäö0-9]+)");
        reArr.push(new RegExp(reStr, "gi"));
        */
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
            if(uniquelist.length < 10) {
                for(let uidx=0; uidx<uniquelist.length; uidx++) {
                    console.debug(JSON.stringify("match? : " + uniquelist[uidx] + " for " + uwlengths[n]));
                }
            }
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
            let baseformArr = convertToBaseForm(uniquewords[i]);
            console.debug("Converted " + uniquewords[i] + " into " + JSON.stringify(baseformArr));
            bases = bases.concat(baseformArr);
        }
        console.debug("n:" + JSON.stringify(bases))

        // again deduplicate
        let uniques = Array.from(new Set(bases));
        uniquewords = uniques;
    }
    // TODO: add ignoreword filtering here.
    const result = uniquewords.filter(word => !ignoreWord(word));

    return result;
}


function generateWordArrayfor(uwlengths) {
    console.log("Generating word array for " + JSON.stringify(uwlengths));

    let wikiwords = generateWordArrayforX(uwlengths, "wikitext");
    let bingwords = generateWordArrayforX(uwlengths, "bingtext");
    let wiktwords = generateWordArrayforX(uwlengths, "wikttext");
    let ratkwords = generateWordArrayforX(uwlengths, "ratktext");
    let synowords = generateWordArrayforX(uwlengths, "synotext");
    
    console.debug("Wiki words: " + JSON.stringify(wikiwords));
    console.debug("Bing words: " + JSON.stringify(bingwords));
    console.debug("Wiktionary words: " + JSON.stringify(wiktwords));
    console.debug("Ratkojat words: " + JSON.stringify(ratkwords));
    console.debug("Synonyymit words: " + JSON.stringify(synowords));

    jspanel_wiki? replacePanel(jspanel_wiki, wikiwords) : null;
    jspanel_bing? replacePanel(jspanel_bing, bingwords) : null;
    jspanel_wikt? replacePanel(jspanel_wikt, wiktwords) : null;
    jspanel_ratk? replacePanel(jspanel_ratk, ratkwords) : null;
    jspanel_syno? replacePanel(jspanel_syno, synowords) : null;
    
    let allwords = wikiwords.concat(bingwords).concat(wiktwords).concat(ratkwords).concat(synowords);

    // make array unique
    let uniquewords = Array.from(new Set(allwords));
    console.log("Total " + uniquewords.length + " words matched");


    GM_setValue("rellusana", uniquewords);
    return uniquewords;
}


/*
async function generateWordArrayfor(uwlengths) {
    let wikitext = GM_getValue("wikitext", " "); // wikipedia
    let bingtext = GM_getValue("bingtext", " "); // bing
    let wikttext = GM_getValue("wikttext", " "); // wiktionary
    let ratktext = GM_getValue("ratktext", " "); // ratkojat
    let synotext = GM_getValue("synotext", " "); // ratkojat

    if (wikitext === " " && bingtext === " " && wikttext === " " && ratktext === " " && synotext === " ") {
        console.warn("No fulltext stored - fetch one first!");
        return;
    }
    // TODO: instead of importing all at once, run three times with different inputs (and calculates statistics)
    let fulltext = wikitext + " " + bingtext + " " + wikttext + " " + ratktext + " " + synotext;

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
        reStr = reStr.replace(/.$/, "(?:[^a-zåäö0-9]+)");
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
            if(uniquelist.length < 10) {
                for(let uidx=0; uidx<uniquelist.length; uidx++) {
                    console.debug(JSON.stringify("match? : " + uniquelist[uidx] + " for " + uwlengths[n]));
                }
            }
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
    // TODO: add ignoreword filtering here.
    const result = uniquewords.filter(word => !ignoreWord(word));

    GM_setValue("rellusana", uniquewords);
    return uniquewords;
}
*/



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

    for (let i = 0; i < wordslist.length; i++) {
        console.debug("Trying " + wordslist[i]);
        document.arvaukset.arvaus.value = wordslist[i];
        document.arvaukset.onsubmit();
    }
    console.log("Testing all words done.");
    //setmouseactions();
}

// Parses teemasana from document
// @return teemasana
function getTeemaSana() {
    // presumes only one teemasana exists and is visible
    let teemasana = document.getElementsByClassName("teema sana")[0].innerText
    if (teemasana == undefined || teemasana == null) {
        throw new Error("Teemasana not found");
    }
    console.debug("Parsed teemasana="+teemasana);
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
        console.debug("Clicked " + param.id);
        //console.debug( JSON.stringify(s) );
        // create placeholders for vis
        createElements();

        // TEST if commenting this would help to internal error: too much recursion
        setmouseactions();

        //TODO: add "vihje sana" class (tuntematon)

        let clickednode = document.getElementById(param.id);
        if (clickednode.className == "teema sana") {
            console.log("Clicked teemasana");

            // set default visualization to empty or not in use based on currently stored setting
            if( GM_getValue("searchWikipedia" ) == true ) setSrcLoadVisToEmpty("wiki");
            else setSrcLoadVisToNA("wiki");
            if( GM_getValue("searchBing" ) == true ) setSrcLoadVisToEmpty("bing");
            else setSrcLoadVisToNA("bing");
            if( GM_getValue("searchWiktionary" ) == true ) setSrcLoadVisToEmpty("wikt");
            else setSrcLoadVisToNA("wikt");
            if( GM_getValue("searchRatkojat" ) == true ) setSrcLoadVisToEmpty("ratk");
            else setSrcLoadVisToNA("ratk");
            if( GM_getValue("searchSynonyymit" ) == true ) setSrcLoadVisToEmpty("syno");
            else setSrcLoadVisToNA("syno");

            // do teemasana default action e.g. fetch all fulltext
            fetchFullTextfor(clickednode.innerText);
        } else if (clickednode.className == "tuntematon sana" || clickednode.className == "fade-in tuntematon sana" || clickednode.className == "tuntematon vinkki sana") {
            console.log("Clicked tuntematon sana");

            let nums = getTuntematonLength( clickednode.innerText );
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


function getTuntematonLength(textContent) {
    // RE to extract word lengths
    let re = /[.]+/g

    // parse matches to text array
    let wordlen = textContent.match(re)
    // convert string array (containing number of dotss) to number array indicating count (i.e. length of word)
    let nums = wordlen.map( item => { return item.length });
    return nums;
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
    let tuntematonA = new Array();
    // get unknown words
    let tuntematonO = document.getElementsByClassName("tuntematon sana")
    for (let item of tuntematonO) {
        let nums = getTuntematonLength( item.textContent );
        tuntematonA.push( nums );
    }
    return tuntematonA;
}

function splitTextToWords( text ) {
    if (text == undefined || text == null || typeof (text) != "string") {
        throw new Error("Invalid input! Expected string, got " + JSON.stringify(text))
    }
    // hard-coded ignore of wikimedia pages not found // TODO: find a better way
    if (text.includes("Wikimedia Error")) {
        return "";
    }


}

// replace tabs,newlines, multispaces etc with single space
function stripWhitespace(text) {
    let multispace = new RegExp(/\s+/gi);
    let stripped = text.replace(multispace, ' ');
    return stripped;
}

function stripText(text) {
    if (text == undefined || text == null || typeof (text) != "string") {
        throw new Error("Invalid input! Expected string, got " + JSON.stringify(text))
    }
    let notwordchars = /[^a-zåäöA-ZÅÄÖ\- ']/gi;
    let wospecialchrs = text.replace(notwordchars, ' ');

    let stripped = stripWhitespace(wospecialchrs);
    let final = stripped.toLowerCase().trim();

    return final;
}


// Wrapper for menu item (to run full-text search for teemasana
// TODO: add search to mouse press on teemasana object
function fetchFullText() {
    return fetchFullTextfor( getTeemaSana() );
}


// Fetches Wikipedia full page from wikipedia (using param ?action=raw) + all other sources
// sana - string containing word that resolves to full page via wikipedia query
// @returns - NA
// @stores - GM global "wikitext"
function fetchFullTextfor(sana) {

    if (GM_getValue("searchWikipedia", true) == true) {
        console.debug("Search for '" + sana + "' <-> [Wikipedia] ");
        setSrcLoadVisToLoading("wiki")

        let wikisanakirjasearchurl = encodeURI('http://fi.wikipedia.org/w/wiki.phtml?search=' + sana.toLowerCase() );
        console.debug("Retrieving URL: " + wikisanakirjasearchurl);
        GM_setValue("wikitext", "");

        GM_xmlhttpRequest({
            method: "GET",
            url: wikisanakirjasearchurl,
            onload: function (response) {
                let newUrl = response.finalUrl;
                console.debug("Received URL: " + newUrl);
                
                // kun vastauksena https://fi.wikipedia.org/w/index.php?search=Kilo&title=Toiminnot%3AHaku&profile=advanced&fulltext=1&ns0=1
                // iteroi vastauksen listan yksitellen, avaa joka sivu RAWina ja purkaa niiden sisällön
                if( newUrl.includes("search=") ) {
                    // iterate through all search results
                    let htmlSearchResults = response.responseText;
                    let resultsPages = parseWikiSearchHtml(htmlSearchResults);
                    for (let i = 0; i < resultsPages.length; i++) {
                        let pageUrl = "https://fi.wikipedia.org/" + resultsPages[i] + "?action=raw";
                        console.debug("Page URL: " + pageUrl);
                        GM_xmlhttpRequest({
                            method: "GET",
                            url: pageUrl,
                            onload: function (response) {
                                let fulltext = response.responseText;
                                let sanitized = stripText(fulltext);
                                let already_found = GM_getValue("wikitext");
                                GM_setValue("wikitext", already_found + " " +sanitized);
                                if(DEBUG) {
                                    console.debug("Wikipedia: " + sanitized); 
                                    //jspanel_wiki? replacePanel(jspanel_wiki, "Wikipedia: " + sanitized): null;
                                }
                                console.log("[Wikipedia] got " + fulltext.length + " chars text; stored " + sanitized.length + " chars, " + sanitized.split(" ").length + " words");
                                setSrcLoadVisToReady("wiki");
                            },
                            onerror: function (response) {
                                console.error("Error " + response.statusText + " retrieving " + sana + " from " + pageUrl)
                            }
                        });
                    }

                }

                let wikisanakirjaurl = newUrl + "?action=raw";

                GM_xmlhttpRequest({
                    method: "GET",
                    url: wikisanakirjaurl,
                    onload: function (response) {
                        let fulltext = response.responseText;

                        // if response is to page that is redirecting to another page
                        if( fulltext.match(/#REDIRECT \[\[.*\]\]/) ) {
                            console.debug("Redirect found, fetching new page");
                            let redirecturl = fulltext.match(/#REDIRECT \[\[(.*)\]\]/)[1];
                            console.debug("Redirect URL: " + redirecturl);
                            let redirecturlraw = encodeURI("https://fi.wikipedia.org/wiki/" + redirecturl + "?action=raw");
                            console.debug("Redirect URL raw: " + redirecturlraw);

                            GM_xmlhttpRequest({
                                method: "GET",
                                url: redirecturlraw,
                                onload: function (response) {
                                    let fulltext = response.responseText;
                                    //TODO remove stripText and improve word splitting
                                    //GM_setValue("wikitext-original", fulltext);
                                    let sanitized = stripText(fulltext);
                                    let already_found = GM_getValue("wikitext");
                                    GM_setValue("wikitext", already_found + " " +sanitized);
                                    if(DEBUG) {
                                        console.debug("Wikipedia: " + sanitized); 
                                        //jspanel_wiki? replacePanel(jspanel_wiki, "Wikipedia: " + sanitized): null;
                                    }
                                    console.log("[Wikipedia] got " + fulltext.length + " chars text; stored " + sanitized.length + " chars, " + sanitized.split(" ").length + " words");
                                    setSrcLoadVisToReady("wiki");
                                },
                                onerror: function (response) {
                                    console.error("Error " + response.statusText + " retrieving " + sana + " from " + redirecturlraw)
                                }
                            });
                        }
                        // otherwise assuming it is a valid page
                        else {
                            let sanitized = stripText(fulltext);
                            let already_found = GM_getValue("wikitext");
                            GM_setValue("wikitext", already_found + " " +sanitized);
                            if(DEBUG) {
                                console.debug("Wikipedia: " + sanitized); 
                                //jspanel_wiki? replacePanel(jspanel_wiki, "Wikipedia: " + sanitized): null;
                            }
                            console.log("[Wikipedia] got " + fulltext.length + " chars text; stored " + sanitized.length + " chars, " + sanitized.split(" ").length + " words");
                            setSrcLoadVisToReady("wiki");    
                        }
                    },
                    onerror: function (response) {
                        console.error("Error " + response.statusText + " retrieving " + sana + " from " + wikisanakirjaurl)
                    }
                });
        
            },
            onerror: function (response) {
                console.error("Error " + response.statusText + " retrieving " + sana + " from " + wikisanakirjaurl)
            }
        });

    } else {
        GM_setValue("wikitext", "");
    }

    if (GM_getValue("searchBing", true) == true) {
        console.debug("Search for '" + sana + "' <-> [Bing] ");
        setSrcLoadVisToLoading("bing")

        let bingurl = encodeURI('https://www.bing.com/search?count=100&q=language:fi+' + sana);

        GM_xmlhttpRequest({
            method: "GET",
            url: bingurl,
            onload: function (response) {
                let htmltext = response.responseText;
                let fulltext = parseBingHtml(htmltext);
                //GM_setValue("bingtext-original", fulltext);
                let sanitized = stripText(fulltext);
                GM_setValue("bingtext", sanitized);
                console.log("[Bing] got " + htmltext.length + " chars html, " + fulltext.length + " chars text; stored " + sanitized.length );
                setSrcLoadVisToReady("bing")
            },
            onerror: function (response) {
                console.error("Error " + response.statusText + " retrieving " + sana + " from " + bingurl)
            }
        });
    } else {
        GM_setValue("bingtext", "");
    }

    if (GM_getValue("searchWiktionary", true) == true) {
        console.debug("Search for '" + sana + "' <-> [Wiktionary] ");
        setSrcLoadVisToLoading("wikt")

        let wikisanakirjasearchurl = encodeURI('http://fi.wiktionary.org/w/wiki.phtml?search=' + sana.toLowerCase() );

        GM_xmlhttpRequest({
            method: "GET",
            url: wikisanakirjasearchurl,
            onload: function (response) {
                let newUrl = response.finalUrl;
                console.debug("Wikisanakirja search URL: " + newUrl);
                let wikisanakirjaurl = newUrl + "?action=raw";

                GM_xmlhttpRequest({
                    method: "GET",
                    url: wikisanakirjaurl,
                    onload: function (response) {
                        let fulltext = response.responseText;
                        //GM_setValue("wikttext-original", fulltext);
                        // TODO: how to store what sana the results are for ? previously: teema sana as first array element
                        // wordslist.unshift( getTeemaSana() );
                        let sanitized = stripText(fulltext);
                        GM_setValue("wikttext", sanitized);
                        if(DEBUG) {
                            console.debug("Wikisanakirja: " + sanitized); 
                            //jspanel_wikt? replacePanel(jspanel_wikt, "Wikisanakirja: " + sanitized): null;
                        }
                        console.log("[Wiktionary] got " + fulltext.length + " chars text; stored " + sanitized.length + " chars, " + sanitized.split(" ").length + " words");
                        setSrcLoadVisToReady("wikt");
                    },
                    onerror: function (response) {
                        console.error("Error " + response.statusText + " retrieving " + sana + " from " + wikisanakirjaurl)
                    }
                });
        
            },
            onerror: function (response) {
                console.error("Error " + response.statusText + " retrieving " + sana + " from " + wikisanakirjaurl)
            }
        });
        //        let wikisanakirjaurl = encodeURI('https://fi.wiktionary.org/wiki/' + sana.toLowerCase() + "?action=raw");

    } else {
        GM_setValue("wikttext", "");
    }

    if (GM_getValue("searchRatkojat", true) == true) {
        console.debug("Search for '" + sana + "' <-> [ratkojat] ");
        setSrcLoadVisToLoading("ratk")

        let ratkojaturl = encodeURI('https://www.ratkojat.fi/hae?s=' + sana.toLowerCase() + '&mode=2');

        GM_xmlhttpRequest({
            method: "GET",
            url: ratkojaturl,
            onload: function (response) {
                let htmltext = response.responseText;
                let fulltext = parseRatkojatHtml(htmltext);
                //GM_setValue("ratktext-original", fulltext);
                let sanitized = stripText(fulltext);
                GM_setValue("ratktext", sanitized);
                if(DEBUG) {
                    console.debug("Ratkojat: " + sanitized); 
                    //jspanel_ratk? replacePanel(jspanel_ratk, "Ratkojat: " + sanitized): null;
                }
                console.log("[ratkojat] got " + htmltext.length + " chars html, " + fulltext.length + " chars text; stored " + sanitized.length);
                setSrcLoadVisToReady("ratk");
            },
            onerror: function (response) {
                console.error("Error " + response.statusText + " retrieving " + sana + " from " + ratkojaturl)
            }
        });
    } else {
        GM_setValue("ratktext", "");
    }

    if (GM_getValue("searchSynonyymit", true) == true) {
        console.debug("Search for '" + sana + "' <-> [synonyymit] ");
        setSrcLoadVisToLoading("syno")

        let searchUrl = encodeURI('https://www.synonyymit.fi/' + sana.toLowerCase() );

        GM_xmlhttpRequest({
            method: "GET",
            url: searchUrl,
            onload: function (response) {
                let htmltext = response.responseText;
                let fulltext = parseSynonyymitHtml(htmltext);
                let sanitized = stripText(fulltext);
                GM_setValue("synotext", sanitized);
                if(DEBUG) {
                    console.debug("Synonyymit: " + sanitized); 
                    //jspanel_syno? replacePanel(jspanel_syno, "Synonyymit: " + sanitized): null;
                }
                console.log("[synonyymit] html: " + htmltext.length + " chars, text:" + fulltext.length + " chars; result:" + sanitized.length + " chars, "+sanitized.split(" ").length+"  words");
                setSrcLoadVisToReady("syno");
            },
            onerror: function (response) {
                console.error("Error " + response.statusText + " retrieving " + sana + " from " + ratkojaturl)
            }
        });
    } else {
        GM_setValue("synotext", "");
    }

}

// Parses html extracting only relevant text elements from BING query results
function parseWikiSearchHtml(htmlres) {
    let el = document.createElement('html');
    el.innerHTML = htmlres;
    let searchResultCollection = el.getElementsByClassName('mw-search-result-heading');
    let resultPages = [];
    for (let item of searchResultCollection) {
        let fixedUrl = item.children[0].href.replace("https://hyotynen.iki.fi/", "");
        console.debug("[Wiki]: search results " + fixedUrl);
        resultPages.push(fixedUrl);
    }
    return resultPages;
}

// Parses html extracting only relevant text elements from BING query results
function parseBingHtml(htmlres) {
    let el = document.createElement('html');
    el.innerHTML = htmlres;
    let searchResultCollection = el.getElementsByClassName('b_attribution');
    let resstr = " ";
    for (let item of searchResultCollection) {
        console.debug("[Bing]: " + item.innerText + " -> " + stripText(item.innerText));
        resstr += item.innerText;
        resstr += " ";
    }
    return resstr;
}

// Parse HTML extracting only relevant text results from ratkojat query
function parseRatkojatHtml(htmlres) {
    let el = document.createElement('html');
    el.innerHTML = htmlres;
    let searchResultCollection = el.getElementsByClassName('w wi');
    let resstr = " ";
    for (let item of searchResultCollection) {
        console.debug("[Ratkojat]: " + item.innerText + " -> " + stripText(item.innerText));
        resstr += item.innerText;
        resstr += " ";
    }
    return resstr;
}

// Parse HTML extracting only relevant text results from synonyymit query
function parseSynonyymitHtml(htmlres) {
    let el = document.createElement('html');
    el.innerHTML = htmlres;

    let resstr = " ";

    // 1. taulukko
    let searchResultCollection = el.getElementsByClassName('first')
    if( searchResultCollection.length > 0 ) {
        let resultColl = searchResultCollection[0].children;

        for (let item of resultColl) {
            console.debug("[Synonyymit]: " + item.textContent + " -> " + stripText(item.textContent));
            resstr += item.textContent;
            resstr += " ";
        }    
    }

    // päätaulukko
    searchResultCollection = el.getElementsByClassName('sec');
    if( searchResultCollection.length > 0 ) {
        let resultColl = searchResultCollection[0].children;

        for (let item of resultColl) {
            console.debug("[Synonyymit]: " + item.textContent + " -> " + stripText(item.textContent));
            resstr += item.textContent;
            resstr += " ";
        }
    }

    // liittyvät sanat taulukko
    searchResultCollection = el.getElementsByClassName('rel');
    if( searchResultCollection.length > 0 ) {
        let resultColl = searchResultCollection[0].children;

        for (let item of resultColl) {
            console.debug("[Synonyymit]: " + item.textContent + "-> " + stripText(item.textContent));
            resstr += item.textContent;
            resstr += " ";
        }
    }

    // katso myös taulukko
    if( searchResultCollection.length > 1 ) {
        let resultColl = searchResultCollection[1].children;

        for (let item of resultColl) {
            console.debug("[Synonyymit]: " + item.textContent + "-> " + stripText(item.textContent));
            resstr += item.textContent;
            resstr += " ";
        }
    }

    // läheisiä sanoja taulukko
    if( searchResultCollection.length > 2 ) {
        let resultColl = searchResultCollection[2].children;

        for (let item of searchResultCollection) {
            console.debug("[Synonyymit] -> " + item.textContent);
            resstr += item.textContent;
            resstr += " ";
        }
    }

    return resstr;
}

function addToPanel(jspanel, text) {
    jspanel.content.innerHTML = jspanel.content.innerHTML + "<p>" + text + "</p>";
}
function replacePanel(jspanel, text) {
    let output = "";
    if( Array.isArray(text) ) {
        for(let i=0; i<text.length; i++) {
            output += text[i] + "<br>";
        }
        jspanel.content.innerHTML = "<p>" + output + "</p>";
    }
    else {
        jspanel.content.innerHTML = "<p>" + text + "</p>";
    }
    
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
    GM_setValue("synotext", "");
}

// create elements for visualizing load
function createElements() {
    if( document.getElementById("ratk") == null ) {
        let s0 = document.createElement("br");
        let s1 = document.createElement("span");
        s1.id="wiki"
        let s2 = document.createElement("span")
        s2.id="ratk"
        let s3 = document.createElement("span")
        s3.id="wikt"
        let s4 = document.createElement("span")
        s4.id="bing"
        let s5 = document.createElement("span")
        s5.id="syno"
        document.getElementById("ratkaistuja").appendChild(s0)
        document.getElementById("ratkaistuja").appendChild(s1)
        document.getElementById("ratkaistuja").appendChild(s2)
        document.getElementById("ratkaistuja").appendChild(s3)
        document.getElementById("ratkaistuja").appendChild(s4)
        document.getElementById("ratkaistuja").appendChild(s5)
    }
}
// map id to visualization string
function mymap(el) {
    let mymap = {
    "ratk" : "R",
    "wiki" : "W",
    "wikt" : "T",
    "bing" : "B",
    "syno" : "S"
    }
    return mymap[el];
}
// set visualization
function setSrcLoadVisToNA(el) {
    document.getElementById(el).innerHTML = mymap(el) + ": ❌ "
}
function setSrcLoadVisToEmpty(el) {
    document.getElementById(el).innerHTML = mymap(el) + ": ◯ "
}
function setSrcLoadVisToLoading(el) {
    document.getElementById(el).innerHTML = mymap(el) + ": ◕ "
}
function setSrcLoadVisToReady(el) {
    document.getElementById(el).innerHTML = mymap(el) + ": ⬤ "
}

function addFooter() {
    let footer = document.createElement("footer");
    document.body.appendChild(footer);
    GM_addStyle ( `
    footer {
        position: sticky;
        bottom: 0;
        background: black;
        color: white;
        padding: 1em;
        min-height: 11em;
      }`
    );
}

(function () {
    'use strict'
    addFooter();

    const jspanelcss = GM_getResourceText('JSPANELCSS');
    GM_addStyle(jspanelcss);


    if(DEBUG)
        createPanels();


    setmouseactions();

    window.addEventListener('load', function () {
        setmouseactions();
    });

}())
