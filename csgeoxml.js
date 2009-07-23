/*********************************************************************\
 *          THIS IS VERSION 1.0                                        *
 *																	  *
 * csgeoxml.js v1.0                      by Matt Bernier for CloudSync *
 * 	adapted from egeoxml.js							by Mike Williams  *
 *                                                                     *
 * A Google Maps API Extension                                         *
 *                                                                     *
 * Renders the contents of a My Maps (or similar) KML file into a 	  *
 *  GOverlay object.										              *
 *                                                                     *
 * EGeoXML Documentation: http://econym.googlepages.com/egeoxml.htm    *
 * CSGeoXML Documentation:  http://devblog.cloudsync.com/csgeoxml/     *
 *                                                                     *
 ***********************************************************************
 *																	  *
 *	The script was adapted from EGeoXml to mimic the 				  *
 *	functionality of GGeoXMl, by creating a single overlay 			  *
 *	out of all the overlays in the kml file.  Thus, allowing		  *
 *	them to be added/removed as one overlay.						  *
 *	Adapted By Matt Bernier mbernier@cloudsync.com					  *
 *	CloudSync, Inc													  *
 *	http://devblog.cloudsync.com/csgeoxml/							  *
 *																	  *
 ***********************************************************************
 *                                                                     *
 *   Original Javascript is provided by Mike Williams                  *
 *   Blackpool Community Church Javascript Team                        *
 *   http://www.commchurch.freeserve.co.uk/                            *
 *   http://econym.googlepages.com/index.htm                           *
 *                                                                     *
 *   This work is licenced under a Creative Commons Licence            *
 *   http://creativecommons.org/licenses/by/2.0/uk/                    *
 *                                                                     *
\*********************************************************************/

/*
 * Changelog 20090715 (akhmadf@gmail.com)
 * - Overlap marker supports. Implemented using codes from: http://c-3-d.org/mappages/expandmarkersdemo.htm 
 * - Fixed duplicate markers bug. Markers array is re-initialized (accumulative) in every addOverlay but never reset
 * - Use listener instead of bindInfoWindow for click handling. Now we can use onOpenFn in iwoptions. eg:
 *   geoXml = new CsGeoXml('csGeoXml', map, kmlpath, {iwoptions: {onOpenFn: function() { gmapFancyBoxHandler();}}} )
 */

function CsGeoXml(myvar, map, url, opts) {
    // store the parameters
    this.myvar = myvar;
    this.map = map;
    this.url = url;
    if (typeof url == "string") {
        this.urls = [url];
    } else {
        this.urls = url;
    }
    this.opts = opts || {};
    // infowindow styles
    this.titlestyle = this.opts.titlestyle || 'style = "font-family: arial, sans-serif;font-size: medium;font-weight:bold;font-size: 100%;"';
    this.descstyle = this.opts.descstyle || 'style = "font-family: arial, sans-serif;font-size: small;padding-bottom:.7em;"';
    this.directionstyle = this.opts.directionstyle || 'style="font-family: arial, sans-serif;font-size: small;padding-left: 1px;padding-top: 1px;padding-right: 4px;"';
    // sidebar/dropbox functions
    this.sidebarfn = this.opts.sidebarfn || CsGeoXml.addSidebar;
    this.dropboxfn = this.opts.dropboxfn || CsGeoXml.addDropdown;
    // elabel options
    this.elabelopacity = this.opts.elabelopacity || 100;
    // other useful "global" stuff
    this.bounds = new google.maps.LatLngBounds();
    this.gmarkers = [];
    this.tmarkers = [];
    this.gpolylines = [];
    this.tpolylines = [];
    this.gpolygons = [];
    this.tpolygons = [];
    this.groundoverlays = [];
    this.side_bar_html = "";
    this.side_bar_list = [];
    this.styles = []; // associative array
    this.iwwidth = this.opts.iwwidth || 250;
    this.progress = 0;
    this.lastmarker = {};
    this.myimages = [];
    this.imageNum =0;
    this.overlapMarkers = [];

    /* Create the data from KML */
    this.parse();
}
 
CsGeoXml.prototype = new google.maps.Overlay();

// uses GXml.value, then removes leading and trailing whitespace
CsGeoXml.value = function(e) {
    a = google.maps.Xml.value(e);
    a = a.replace(/^\s*/,"");
    a = a.replace(/\s*$/,"");
    return a;
}

// Create Marker

CsGeoXml.prototype.createMarker = function(data) {
    var point = data.point;
    var name = data.name;
    var desc = data.desc;
    var style = data.styleInfo;
	
    var icon = G_DEFAULT_ICON;
    var myvar=this.myvar;
    var iwoptions = this.opts.iwoptions || {};
    var markeroptions = this.opts.markeroptions || {};
    var icontype = this.opts.icontype || "style";
  
    var data = {};

    if (icontype == "style") {
        if (!!this.styles[style]) {
            icon = this.styles[style];
        }
    }
    if (!markeroptions.icon) {
        markeroptions.icon = icon;
    }
    
    //var m = new google.maps.Marker(point, markeroptions);
    var m = this.createMarker2(point, markeroptions);

    // Attempt to preload images
    if (this.opts.preloadimages) {
        var text = desc;
        var pattern = /<\s*img/ig;
        var result;
        var pattern2 = /src\s*=\s*[\'\"]/;
        var pattern3 = /[\'\"]/;

        while ((result = pattern.exec(text)) != null) {
            var stuff = text.substr(result.index);
            var result2 = pattern2.exec(stuff);
            if (result2 != null) {
                stuff = stuff.substr(result2.index+result2[0].length);
                var result3 = pattern3.exec(stuff);
                if (result3 != null) {
                    var imageUrl = stuff.substr(0,result3.index);
                    this.myimages[this.imageNum] = new Image();
                    this.myimages[this.imageNum].src = imageUrl;
                    this.imageNum++;
                }
            }
        }
    }

    if (this.opts.elabelclass) {
        var l = new ELabel(point, name, this.opts.elabelclass, this.opts.elabeloffset, this.elabelopacity, true);
        data.label = l;
    }

    var html = "<div>"
    /*+ "<h1 "+this.titlestyle+">"+name+"</h1>"*/
    + "<strong "+this.titlestyle+">"+name+"</strong>"
    +"<div "+this.descstyle+">"+desc+"</div>"
    +"</div>";

    var markerCallback = (function(curmap) {
        return function(latlng)  {
            if (latlng)
                point = latlng;
            curmap.openInfoWindowHtml(point, html, iwoptions);
        }
    } )(this.map);
    google.maps.Event.addListener(m, "click", markerCallback);

    if (!!this.opts.addmarker) {
        this.opts.addmarker(m,name,desc,icon.image,this.gmarkers.length)
    } else {
        this.map.addOverlay(m);
    }
  
    this.gmarkers.push(m);

    //console.log('this.gmarkers.length:', this.gmarkers.length);

    if (this.opts.sidebarid || this.opts.dropboxid) {
        var n = this.gmarkers.length-1;
        this.side_bar_list.push (name + "$$$marker$$$" + n +"$$$" );
    }

}

// Create Polyline

CsGeoXml.prototype.createPolyline = function(data) {
    var points = data.points;
    var color = data.color;
    var width = data.width;
    var opacity = data.opacity;
    var pbounds = data.pbounds;
    var name = data.name;
    var desc = data.desc;
	
    var thismap = this.map;
    var iwoptions = this.opts.iwoptions || {};
    var polylineoptions = this.opts.polylineoptions || {};
    var p = new google.maps.Polyline(points,color,width,opacity,polylineoptions);
    this.map.addOverlay(p);
    this.gpolylines.push(p);
    var html = "<div style='font-weight: bold; font-size: medium; margin-bottom: 0em;'>"+name+"</div>"
    +"<div style='font-family: Arial, sans-serif;font-size: small;width:"+this.iwwidth+"px'>"+desc+"</div>";
    google.maps.Event.addListener(p,"click", function() {
        thismap.openInfoWindowHtml(p.getVertex(Math.floor(p.getVertexCount()/2)),html,iwoptions);
    } );
    if (this.opts.sidebarid) {
        var n = this.gpolylines.length-1;
        var blob = '&nbsp;&nbsp;<span style=";border-left:'+width+'px solid '+color+';">&nbsp;</span> ';
        this.side_bar_list.push (name + "$$$polyline$$$" + n +"$$$" + blob );
    }
}

// Create Polygon

CsGeoXml.prototype.createPolygon = function() {
    var points = data.points;
    var color = data.color;
    var width = data.width;
    var opacity = data.opacity;
    var fillcolor = data.fillcolor;
    var fillopacity = data.fillopacity;
    var pbounds = data.pbounds;
    var name = data.name;
    var desc = data.desc;
	
	
    var thismap = this.map;
    var iwoptions = this.opts.iwoptions || {};
    var polygonoptions = this.opts.polygonoptions || {};
    var p = new google.maps.Polygon(points,color,width,opacity,fillcolor,fillopacity,polygonoptions)
    this.map.addOverlay(p);
    this.gpolygons.push(p);
    var html = "<div style='font-weight: bold; font-size: medium; margin-bottom: 0em;'>"+name+"</div>"
    +"<div style='font-family: Arial, sans-serif;font-size: small;width:"+this.iwwidth+"px'>"+desc+"</div>";
    google.maps.Event.addListener(p,"click", function() {
        thismap.openInfoWindowHtml(pbounds.getCenter(),html,iwoptions);
    } );
    if (this.opts.sidebarid) {
        var n = this.gpolygons.length-1;
        var blob = '<span style="background-color:' +fillcolor + ';border:2px solid '+color+';">&nbsp;&nbsp;&nbsp;&nbsp;</span> ';
        this.side_bar_list.push (name + "$$$polygon$$$" + n +"$$$" + blob );
    }
}

// Sidebar factory method One - adds an entry to the sidebar
CsGeoXml.addSidebar = function(myvar,name,type,i,graphic) {
    if (type == "marker") {
        return '<a href="javascript:GEvent.trigger(' + myvar+ '.gmarkers['+i+'],\'click\')">' + name + '</a><br>';
    }
    if (type == "polyline") {
        return '<div style="margin-top:6px;"><a href="javascript:GEvent.trigger(' + myvar+ '.gpolylines['+i+'],\'click\')">' + graphic + name + '</a></div>';
    }
    if (type == "polygon") {
        return '<div style="margin-top:6px;"><a href="javascript:GEvent.trigger(' + myvar+ '.gpolygons['+i+'],\'click\')">' + graphic + name + '</a></div>';
    }
}

// Dropdown factory method
CsGeoXml.addDropdown = function(myvar,name,type,i,graphic) {
    return '<option value="' + i + '">' + name +'</option>';
}

// Request to Parse an XML file

CsGeoXml.prototype.parse = function() {
    // clear some variables
    this.gmarkers = [];
    this.gpolylines = [];
    this.gpolygons = [];
    this.groundoverlays = [];
    this.side_bar_html = "";
    this.side_bar_list = [];
    this.styles = []; // associative array
    this.lastmarker = {};
    this.myimages = [];
    this.imageNum =0;
    var that = this;
    this.progress = this.urls.length;
    for (u=0; u<this.urls.length; u++) {
        google.maps.DownloadUrl(this.urls[u], function(doc) {
            that.processing(doc);
        });
    }
}

CsGeoXml.prototype.parseString = function(doc) {
    // clear some variables
    this.gmarkers = [];
    this.gpolylines = [];
    this.gpolygons = [];
    this.groundoverlays = [];
    this.side_bar_html = "";
    this.side_bar_list = [];
    this.styles = []; // associative array
    this.lastmarker = {};
    this.myimages = [];
    this.imageNum =0;
    if (typeof doc == "string") {
        this.docs = [doc];
    } else {
        this.docs = doc;
    }
    this.progress = this.docs.length;
    for (u=0; u<this.docs.length; u++) {
        this.processing(this.docs[u]);
    }
}

CsGeoXml.prototype.processing = function (doc) 
{ 
    var that = this;
    var xmlDoc = google.maps.Xml.parse(doc)
    this.polylines = [];
    this.markers = [];
    this.polygons = [];

    var styles = xmlDoc.documentElement.getElementsByTagName("Style");
    for (var i = 0; i <styles.length; i++) 
    {
        var styleID = styles[i].getAttribute("id");
        var icons=styles[i].getElementsByTagName("Icon");
        // This might not be am icon style
        if (icons.length > 0) {
            var href=CsGeoXml.value(icons[0].getElementsByTagName("href")[0]);
            if (!!href) {
                if (!!that.opts.baseicon) {
                    that.styles["#"+styleID] = new google.maps.Icon(that.opts.baseicon,href);
                } else {
                    that.styles["#"+styleID] = new google.maps.Icon(G_DEFAULT_ICON,href);
                    that.styles["#"+styleID].iconSize = new google.maps.Size(32,32);
                    that.styles["#"+styleID].shadowSize = new google.maps.Size(59,32);
                    that.styles["#"+styleID].dragCrossAnchor = new google.maps.Point(2,8);
                    that.styles["#"+styleID].iconAnchor = new google.maps.Point(16,32);
                    if (that.opts.printgif) {
                        var bits = href.split("/");
                        var gif = bits[bits.length-1];
                        gif = that.opts.printgifpath + gif.replace(/.png/i,".gif");
                        that.styles["#"+styleID].printImage = gif;
                        that.styles["#"+styleID].mozPrintImage = gif;
                    }
                    if (!!that.opts.noshadow) {
                        that.styles["#"+styleID].shadow="";
                    } else {
                        // Try to guess the shadow image
                        if (href.indexOf("/red.png")>-1
                            || href.indexOf("/blue.png")>-1
                            || href.indexOf("/green.png")>-1
                            || href.indexOf("/yellow.png")>-1
                            || href.indexOf("/lightblue.png")>-1
                            || href.indexOf("/purple.png")>-1
                            || href.indexOf("/pink.png")>-1
                            || href.indexOf("/orange.png")>-1
                            || href.indexOf("-dot.png")>-1 ) {
                            that.styles["#"+styleID].shadow="http://maps.google.com/mapfiles/ms/micons/msmarker.shadow.png";
                        }
                        else if (href.indexOf("-pushpin.png")>-1) {
                            that.styles["#"+styleID].shadow="http://maps.google.com/mapfiles/ms/micons/pushpin_shadow.png";
                        }
                        else {
                            var shadow = href.replace(".png",".shadow.png");
                            that.styles["#"+styleID].shadow=shadow;
                        }
                    }
                }
            }
        }
        // is it a LineStyle ?
        var linestyles=styles[i].getElementsByTagName("LineStyle");
        if (linestyles.length > 0) {
            var width = parseInt(GXml.value(linestyles[0].getElementsByTagName("width")[0]));
            if (width < 1) {
                width = 5;
            }
            var color = CsGeoXml.value(linestyles[0].getElementsByTagName("color")[0]);
            var aa = color.substr(0,2);
            var bb = color.substr(2,2);
            var gg = color.substr(4,2);
            var rr = color.substr(6,2);
            color = "#" + rr + gg + bb;
            var opacity = parseInt(aa,16)/256;
            if (!that.styles["#"+styleID]) {
                that.styles["#"+styleID] = {};
            }
            that.styles["#"+styleID].color=color;
            that.styles["#"+styleID].width=width;
            that.styles["#"+styleID].opacity=opacity;
        }
        // is it a PolyStyle ?
        var polystyles=styles[i].getElementsByTagName("PolyStyle");
        if (polystyles.length > 0) {
            var fill = parseInt(GXml.value(polystyles[0].getElementsByTagName("fill")[0]));
            var outline = parseInt(GXml.value(polystyles[0].getElementsByTagName("outline")[0]));
            var color = CsGeoXml.value(polystyles[0].getElementsByTagName("color")[0]);

            if (polystyles[0].getElementsByTagName("fill").length == 0) {
                fill = 1;
            }
            if (polystyles[0].getElementsByTagName("outline").length == 0) {
                outline = 1;
            }
            var aa = color.substr(0,2);
            var bb = color.substr(2,2);
            var gg = color.substr(4,2);
            var rr = color.substr(6,2);
            color = "#" + rr + gg + bb;

            var opacity = parseInt(aa,16)/256;
            if (!that.styles["#"+styleID]) {
                that.styles["#"+styleID] = {};
            }
            that.styles["#"+styleID].fillcolor=color;
            that.styles["#"+styleID].fillopacity=opacity;
            if (!fill) that.styles["#"+styleID].fillopacity = 0;
            if (!outline) that.styles["#"+styleID].opacity = 0;
        }
    }

    // Read through the Placemarks
    var placemarks = xmlDoc.documentElement.getElementsByTagName("Placemark");
    for (var i = 0; i < placemarks.length; i++) {
        var name=CsGeoXml.value(placemarks[i].getElementsByTagName("name")[0]);
        var desc=CsGeoXml.value(placemarks[i].getElementsByTagName("description")[0]);
        if (desc.match(/^http:\/\//i)) {
            desc = '<a href="' + desc + '">' + desc + '</a>';
        }
        if (desc.match(/^https:\/\//i)) {
            desc = '<a href="' + desc + '">' + desc + '</a>';
        }
        var style=CsGeoXml.value(placemarks[i].getElementsByTagName("styleUrl")[0]);
        var coords=GXml.value(placemarks[i].getElementsByTagName("coordinates")[0]);
        coords=coords.replace(/\s+/g," "); // tidy the whitespace
        coords=coords.replace(/^ /,"");    // remove possible leading whitespace
        coords=coords.replace(/ $/,"");    // remove possible trailing whitespace
        coords=coords.replace(/, /,",");   // tidy the commas
        var path = coords.split(" ");

        // Is this a polyline/polygon?
        if (path.length > 1) {
            // Build the list of points
            var points = [];
            var pbounds = new google.maps.LatLngBounds();
            for (var p=0; p<path.length-1; p++) {
                var bits = path[p].split(",");
                var point = new google.maps.LatLng(parseFloat(bits[1]),parseFloat(bits[0]));
                points.push(point);
                that.bounds.extend(point);
                pbounds.extend(point);
            }
            var linestring=placemarks[i].getElementsByTagName("LineString");
            if (linestring.length) {
                // it's a polyline grab the info from the style
                if (!!that.styles[style]) {
                    var width = that.styles[style].width;
                    var color = that.styles[style].color;
                    var opacity = that.styles[style].opacity;
                } else {
                    var width = 5;
                    var color = "#0000ff";
                    var opacity = 0.45;
                }
                // Does the user have their own createmarker function?
                var data = {
                    points: points,
                    width: width,
                    opacity: opacity,
                    pbounds:pbounds,
                    name:name,
                    desc: desc
                };
                that.tpolylines.push(data);
            }

            var polygons=placemarks[i].getElementsByTagName("Polygon");
            if (polygons.length) {
                // it's a polygon grab the info from the style
                if (!!that.styles[style]) {
                    var width = that.styles[style].width;
                    var color = that.styles[style].color;
                    var opacity = that.styles[style].opacity;
                    var fillopacity = that.styles[style].fillopacity;
                    var fillcolor = that.styles[style].fillcolor;
                } else {
                    var width = 5;
                    var color = "#0000ff";
                    var opacity = 0.45;
                    var fillopacity = 0.25;
                    var fillcolor = "#0055ff";
                }
                // Does the user have their own createmarker function?
                var data = {
                    points: points,
                    color: color,
                    width: width,
                    opacity: opacity,
                    fillcolor: fillcolor,
                    fillopacity: fillopacity,
                    pbounds: pbounds,
                    name: name,
                    desc: desc
                };
                that.tpolygons.push(data);
            }


        } else {
            // It's not a poly, so I guess it must be a marker
            var bits = path[0].split(",");
            var point = new google.maps.LatLng(parseFloat(bits[1]),parseFloat(bits[0]));
            that.bounds.extend(point);
            // Does the user have their own createmarker function?
            var data = {
                point: point,
                name: name,
                desc: desc,
                styleInfo: style
            };
        
            that.tmarkers.push(data);
        }
    }
    
    // Scan through the Ground Overlays
    var grounds = xmlDoc.documentElement.getElementsByTagName("GroundOverlay");
    for (var i = 0; i < grounds.length; i++) {
        var url=CsGeoXml.value(grounds[i].getElementsByTagName("href")[0]);
        var north=parseFloat(GXml.value(grounds[i].getElementsByTagName("north")[0]));
        var south=parseFloat(GXml.value(grounds[i].getElementsByTagName("south")[0]));
        var east=parseFloat(GXml.value(grounds[i].getElementsByTagName("east")[0]));
        var west=parseFloat(GXml.value(grounds[i].getElementsByTagName("west")[0]));
        var sw = new google.maps.LatLng(south,west);
        var ne = new google.maps.LatLng(north,east);
        var ground = new google.maps.GroundOverlay(url, new google.maps.LatLngBounds(sw,ne));
        that.bounds.extend(sw);
        that.bounds.extend(ne);
        that.groundoverlays.push(ground);
        that.map.addOverlay(ground);
    }

    // Is this the last file to be processed?
    that.progress--;
    if (that.progress == 0) {
        // Shall we display the sidebar?
        if (that.opts.sortbyname) {
            that.side_bar_list.sort();
        }
        if (that.opts.sidebarid) {
            for (var i=0; i<that.side_bar_list.length; i++) {
                var bits = that.side_bar_list[i].split("$$$",4);
                that.side_bar_html += that.sidebarfn(that.myvar,bits[0],bits[1],bits[2],bits[3]);
            }
            document.getElementById(that.opts.sidebarid).innerHTML += that.side_bar_html;
        }
        if (that.opts.dropboxid) {
            for (var i=0; i<that.side_bar_list.length; i++) {
                var bits = that.side_bar_list[i].split("$$$",4);
                if (bits[1] == "marker") {
                    that.side_bar_html += that.dropboxfn(that.myvar,bits[0],bits[1],bits[2],bits[3]);
                }
            }
            document.getElementById(that.opts.dropboxid).innerHTML = '<select onChange="var I=this.value;if(I>-1){GEvent.trigger('+that.myvar+'.gmarkers[I],\'click\'); }">'
            + '<option selected> - Select a location - </option>'
            + that.side_bar_html
            + '</select>';
        }

        google.maps.Event.trigger(that,"parsed");
    }
}

/*
 * Called when map.addOverlay() is called, individually adds each overlay
 */ 
CsGeoXml.prototype.initialize = function() 
{    
    var self = this;
    var thismap = this.map;
	
    //create polylines from this.gpolylines - dont forget to add the listeners
    for (var i =0; i<self.tpolylines.length; i++) {
        var pl = self.tpolylines[i];
        if (!!self.opts.createpolyline) {
            self.opts.createpolyline(pl);
        } else {
            self.createPolyline(pl);
        }
    }

    for (var i =0; i<self.tpolygons.length; i++) {
        var pg =self.tpolygons[i];
        if (!!self.opts.createpolygon) {
            self.opts.createpolygon(pg);
        } else {
            self.createPolygon(pg);
        }
    }
	
    for (var i =0; i<self.tmarkers.length; i++) {
        var m = self.tmarkers[i];
        if (!!self.opts.createmarker) {
            self.opts.createmarker(m);
        } else {
            self.createMarker(m);
        }
    }

    for (var i =0; i< this.groundoverlays.length; i++) {
        thismap.addOverlay(this.groundoverlays[i]);
    }
	
    // Shall we zoom to the bounds?
    if (!self.opts.nozoom) {
        self.map.setZoom(self.map.getBoundsZoomLevel(self.bounds));
        self.map.setCenter(self.bounds.getCenter());
    }
	
    this.map = thismap;
}

/*
 * Called when map.removeOverlay is called, individually removes each overlay
 */
CsGeoXml.prototype.remove = function (map)
{
    var thismap = this.map;
    var self = this;

    for (var i =0; i< self.gpolylines.length; i++) {
        var pl = self.gpolylines[i];
        thismap.removeOverlay(pl);
    }

    for (var i=0; i< self.gpolygons.length; i++) {
        var pl = self.gpolygons[i];
        thismap.removeOverlay(pl);
    }

    for (var i=0; i < self.gmarkers.length; i++) {
        var pl = self.gmarkers[i];
        thismap.removeOverlay(pl);
    }

    for (var i=0; i < self.overlapMarkers.length; i++) {
        var pl = self.overlapMarkers[i];
        //console.log(pl);
        thismap.removeOverlay(pl);
    }

    // reset arrays as they will be initialized again
    self.gpolylines = [];
    self.gpolygons = [];
    self.gmarkers = [];
    self.overlapMarkers = [];
}

//not implemented
CsGeoXml.prototype.redraw = function ()
{
    //not implemented as the current functionality does not exactly need the bounds of the window
    }

//not implemented
CsGeoXml.prototype.copy = function ()
{
    //not implemented as the current implementation is just for adding the data to the map
    }

/* shold have been private */

/*CsGeoXml.prototype.setOuterBounds = function (num) {
        var n_outer = markers[num].startcoord.lat() + .5*((markers[num].n_outer - markers[num].s_outer + .00075) / Math.pow(2, -(17 - this.map.getZoom())));
        var s_outer = markers[num].startcoord.lat() - .5*((markers[num].n_outer - markers[num].s_outer) / Math.pow(2, -(17 - this.map.getZoom())));
        var e_outer = markers[num].startcoord.lng() + .5*((markers[num].e_outer - markers[num].w_outer + .00025) / Math.pow(2, -(17 - this.map.getZoom())));
        var w_outer = markers[num].startcoord.lng() - .5*((markers[num].e_outer - markers[num].w_outer + .00025) / Math.pow(2, -(17 - this.map.getZoom())));
        var newOuterBounds = new GLatLngBounds(new GLatLng(s_outer, w_outer), new GLatLng(n_outer, e_outer));
        return newOuterBounds;
    }*/

CsGeoXml.prototype.createMarker2 = (function() {
    //window.sharedFilesURL = 'http://www.williams.edu/Economics/ArtsEcon/mappages/SharedMapFiles/';
    var map = this.map;

    function markerOrder(marker,b) {
        return GOverlay.getZIndex(marker.getPoint().lat()) + marker.importance*1000000;
    }

    function setOuterBounds(num) {
        var n_outer = this.overlapMarkers[num].startcoord.lat() + .5*((this.overlapMarkers[num].n_outer - this.overlapMarkers[num].s_outer + .00075) / Math.pow(2, -(17 - this.map.getZoom())));
        var s_outer = this.overlapMarkers[num].startcoord.lat() - .5*((this.overlapMarkers[num].n_outer - this.overlapMarkers[num].s_outer) / Math.pow(2, -(17 - this.map.getZoom())));
        var e_outer = this.overlapMarkers[num].startcoord.lng() + .5*((this.overlapMarkers[num].e_outer - this.overlapMarkers[num].w_outer + .00025) / Math.pow(2, -(17 - this.map.getZoom())));
        var w_outer = this.overlapMarkers[num].startcoord.lng() - .5*((this.overlapMarkers[num].e_outer - this.overlapMarkers[num].w_outer + .00025) / Math.pow(2, -(17 - this.map.getZoom())));
        var newOuterBounds = new GLatLngBounds(new GLatLng(s_outer, w_outer), new GLatLng(n_outer, e_outer));
        return newOuterBounds;
    }

    //function newMarker(location, html, iconcolor, iconnum, iconsize) {
    function newMarker(location, markeroptions) {
        //console.log('invoked for: ', location, markeroptions);
        /*var customicon = new GIcon(G_DEFAULT_ICON);
        customicon.infoWindowAnchor = new GPoint(11,35);
        if (iconcolor && iconnum && iconsize) {
            customicon.image = window.sharedFilesURL + 'markers/' + iconsize +'/'+ iconcolor +'/'+ iconnum +'.png';
            if (iconsize=='small') {
                customicon.shadow = window.sharedFilesURL + 'markers/' + iconsize +'/shadow.png';
                customicon.iconSize = new GSize(12, 20);
                customicon.shadowSize = new GSize(22, 20);
                customicon.iconAnchor = new GPoint(6, 20);
                customicon.infoWindowAnchor = new GPoint(5, 1);
            }
        }*/

        markeroptions.zIndexProcess = markerOrder;
        var temp_marker = new google.maps.Marker(location, markeroptions);

        //temp_marker.iconcolorurl = iconcolor;
        //temp_marker.iconnumurl = iconnum;
        //temp_marker.iconsizeurl = iconsize;
        //if (iconcolor==null && iconnum==null && iconsize==null) {
        temp_marker.startimport=2;
        temp_marker.importance=2;
        /*}
        else {
            temp_marker.startimport=1;
            temp_marker.importance=1;
        }*/
        temp_marker.targeted=0;
        temp_marker.startcoord=location;
        temp_marker.openwindow=false;
        temp_marker.line = null;
        temp_marker.shifted = 0;

        var t_error = .0003;
        var shift = .0005;
        var n_coord = temp_marker.getLatLng().lat() + t_error;
        var s_coord = temp_marker.getLatLng().lat() - t_error;
        var e_coord = temp_marker.getLatLng().lng() + t_error;
        var w_coord = temp_marker.getLatLng().lng() - t_error;
        temp_marker.inBounds = new GLatLngBounds(new GLatLng(s_coord, w_coord), new GLatLng(n_coord, e_coord));


        temp_marker.n_outer = temp_marker.startcoord.lat()+shift;
        temp_marker.s_outer = temp_marker.startcoord.lat()-shift;
        temp_marker.e_outer = temp_marker.startcoord.lng()+shift;
        temp_marker.w_outer = temp_marker.startcoord.lng()-shift;
        temp_marker.outBounds = null;

        GEvent.addListener(temp_marker, "mouseover", 
            (function (curmap, that) {
                return function() {
                    var map = curmap;
                    if (map.getZoom() >= 14) {
                        var step = 0;
                        for (x = 0; x < that.overlapMarkers.length; x++) {
                            var target = that.overlapMarkers[x].getLatLng();
                            if (temp_marker.inBounds.containsLatLng(target)==true && that.overlapMarkers[x].isHidden()==false) {
                                step++;
                                that.overlapMarkers[x].targeted=1;
                                that.overlapMarkers[x].outBounds = setOuterBounds.apply(that, [x]);
                            };
                        };
                        if (step == 1) {
                            temp_marker.targeted = 0;
                            temp_marker.outBounds = null;
                        };
                        if (step > 1) {
                            if (!map.getInfoWindow().isHidden()) {
                                map.closeInfoWindow();
                            }
                            var tick = 1;
                            var deg = (360 / (step));
                            for (x = 0; x < that.overlapMarkers.length; x++) {
                                if (that.overlapMarkers[x].targeted==1 && that.overlapMarkers[x].shifted==0) {
                                    map.removeOverlay(that.overlapMarkers[x]);
                                    var delta_lat = (shift +  shift*(Math.pow(2, (17 - map.getZoom())) - 1)) * Math.cos(((deg * tick) * Math.PI) / 180);
                                    var delta_lng = (shift +  shift*(Math.pow(2, (17 - map.getZoom())) - 1)) * Math.sin(((deg * tick) * Math.PI) / 180);
                                    var point_latlng = new GLatLng((that.overlapMarkers[x].startcoord.lat() + (delta_lat * .15)), (that.overlapMarkers[x].startcoord.lng() + (delta_lng * .15)));
                                    var new_lat = that.overlapMarkers[x].getLatLng().lat() + delta_lat;
                                    var new_lng = that.overlapMarkers[x].getLatLng().lng() + delta_lng;
                                    that.overlapMarkers[x].setLatLng(new GLatLng(new_lat, new_lng));
                                    that.overlapMarkers[x].importance=10;
                                    map.addOverlay(that.overlapMarkers[x]);
                                    //that.overlapMarkers[x].setImage(window.sharedFilesURL + 'markers/' + that.overlapMarkers[x].iconsizeurl +'/'+ that.overlapMarkers[x].iconcolorurl +'/'+ that.overlapMarkers[x].iconnumurl + '.png');

                                    that.overlapMarkers[x].line = new GPolyline([
                                        that.overlapMarkers[x].startcoord,
                                        that.overlapMarkers[x].getLatLng()],
                                        '#000000', 6, 1);
                                    map.addOverlay(that.overlapMarkers[x].line);

                                    var linepointcolor = '#9BE61A';
                                    if (that.overlapMarkers[x].iconsizeurl=='small') {
                                        linepointcolor='#62D962';
                                    }
                                    that.overlapMarkers[x].point = new GPolyline([
                                        that.overlapMarkers[x].startcoord,
                                        point_latlng],
                                        linepointcolor, 3, 1);
                                    map.addOverlay(that.overlapMarkers[x].point);

                                    that.overlapMarkers[x].shifted=1;
                                    tick++;
                                };
                            };
                        };
                        GEvent.addListener(map, "mousemove", function(latlng) {
                            for (x = 0; x < that.overlapMarkers.length; x++) {
                                if (that.overlapMarkers[x].targeted==1 && that.overlapMarkers[x].outBounds.containsLatLng(latlng)==false) {
                                    if (!map.getInfoWindow().isHidden()) {
                                        map.closeInfoWindow();
                                    }
                                    map.removeOverlay(that.overlapMarkers[x].line);
                                    map.removeOverlay(that.overlapMarkers[x].point);
                                    map.removeOverlay(that.overlapMarkers[x]);
                                    that.overlapMarkers[x].setLatLng(that.overlapMarkers[x].startcoord);
                                    that.overlapMarkers[x].targeted=0;
                                    that.overlapMarkers[x].shifted=0;
                                    that.overlapMarkers[x].importance = that.overlapMarkers[x].startimport;
                                    map.addOverlay(that.overlapMarkers[x]);
                                    //that.overlapMarkers[x].setImage(window.sharedFilesURL + 'markers/' + that.overlapMarkers[x].iconsizeurl +'/'+ that.overlapMarkers[x].iconcolorurl +'/'+ that.overlapMarkers[x].iconnumurl + '.png');
                                    if (that.overlapMarkers[x].openwindow==true) {
                                        GEvent.trigger(that.overlapMarkers[x], "click")
                                    };
                                    that.overlapMarkers[x].openwindow=false;
                                };
                            };
                        });
                    };
                };
            })(this.map, this));

        /*GEvent.addListener(temp_marker, "click", function() {
            for (i=0; i < this.overlapMarkers.length; i++) {
                this.overlapMarkers[i].openwindow=false;
            }
            temp_marker.openInfoWindowHtml(html);
            temp_marker.openwindow=true;
        });*/
        this.overlapMarkers.push(temp_marker);
        return temp_marker;
    }
    return newMarker;
})();

