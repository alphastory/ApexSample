$ = jQuery.noConflict();
var locator = locator || {
	open: false,
	key_maps:'{{ REMOVED FOR SECURITY }}',
	timeoutId:'',
	marketRadius: 75, //miles
	userLocation:{},
	center: { lng:-86.158019, lat:39.768470 }, //indy NOT USED
	francCoord: [],
	init: function(){
		$.ajax({
			type: "POST",
			url: ajax_object.ajaxurl,
			data: {
				action: 'get_all_markets' // this is wp_ajax_get_all_markets hook
			},
			success: function( response ){
				locator.francCoord = $.parseJSON( response );
				locator.bindings();
				if( users_market == '' || users_market == null ){
					locator.autoLocate();
				}
			}
		} );
	},

	bindings: function(){
		if( $( '.careers-header' ).length < 1 ){
			$( 'p.change' ).off().on( 'click', function(){
				locator.reveal();
			} );
		}

		$( 'div.btn.keep' ).off().on( 'click', function(){
			var city = $( '#header #location .city' ).text();
			users_market = city;
			$.ajax({
				type: "POST",
				url: ajax_object.ajaxurl,
				data: {
					action: 'set_local_market', // this is wp_ajax_set_local_market hook
					market: city
				}
			} );
			locator.conceal();
		} );
	},

	// =================================================================================================================
	// THIS AREA ISN'T MY LOGIC
	// =================================================================================================================
	// This function grabs the distance between
	// 2 lat/long coordinate pairs so that we can
	// determine what action to take in another
	// function. Retrieved from a StackOverflow answer.
	// =================================================================================================================
	// http://stackoverflow.com/questions/18883601/function-to-calculate-distance-between-two-coordinates-shows-wrong
	// =================================================================================================================

	getDistBetween:function( point1, point2 ){
		//helper func to convert to rads
		Number.prototype.toRadians = function() {
			return this * Math.PI / 180;
		}

		var miles = 3959;
		var km = 6371;
		var measurement = miles;

		//calculate the distance between points   3959=miles  6371=km
		var φ1 = point1.lat.toRadians(),
			φ2 = point2.lat.toRadians(),
			Δλ = (point2.lng-point1.lng).toRadians(),
			R = measurement; // gives d in miles
		var d = Math.acos( Math.sin( φ1 ) * Math.sin( φ2 ) + Math.cos( φ1 ) * Math.cos( φ2 ) * Math.cos( Δλ ) ) * R;

		return d;
	},

	// =================================================================================================================
	// END BORROWED LOGIC AREA
	// =================================================================================================================


	// This locates
	autoLocate: function(){
		// Geolocation Supported
		//checking aginst ie9 due to CORS issues
		if(navigator.geolocation && !$('HTML.lt-ie10').length){
			locator.timeoutId = setTimeout(locator.disabledGeoHandler, 6000);
			navigator.geolocation.getCurrentPosition(setUserPosition);
		} else {
			// When Geolocation is not supported.
			locator.disabledGeoHandler();
		}

		function setUserPosition (position){
			clearTimeout(locator.timeoutId);
			locator.userLocation = { lng: position.coords.longitude, lat: position.coords.latitude };
			locator.detLocalMarket( true );
		}
	},

	// What to do if permissions are denied
	disabledGeoHandler: function(){
		var has_visited = $( '.has_visited' ).text();
		clearTimeout(locator.timeoutId);

		// ***********************************************************************
		// This is where the user enters the zip and calls this function:
		// ***********************************************************************
		if( users_market == '' && has_visited == 'false' ){
			$.ajax({
				type: "POST",
				url: ajax_object.ajaxurl,
				data: {
					action: 'set_local_market', // this is wp_ajax_set_local_market hook
					market: 'Indianapolis, IN'
				},
				success: function(){
					if( users_market == '' ){
						users_market = 'Indianapolis, IN';
						$( '.user_market' ).text( users_market );
					}
				}
			} );
		}
	},

	// Local function to run after the geolocation works.
	detLocalMarket: function ( auto ){
		clearTimeout(locator.timeoutId);
		//find distances for all markets

		var francDistances = new Array();
		for (var i=0;i<locator.francCoord.length;i++){
			francDistances.push( locator.getDistBetween( locator.userLocation, locator.francCoord[ i ] ) );
		}

		//determine the arr index of closest market
		var closestMarketIndex = locator.getClosestMarketInd( francDistances );



		//determine if user is in radius of closest market
		if(francDistances[closestMarketIndex]<= locator.marketRadius){
			if( auto ){
				//set this market as users local
				$.ajax({
					type: "POST",
					url: ajax_object.ajaxurl,
					data: {
						action: 'set_local_market', // this is wp_ajax_get_all_markets hook
						market: locator.francCoord[ closestMarketIndex ].name
					},
					success: function( response ){
						locator.update( response );
					}
				} );
			} else {
				var loc = locator.francCoord[ closestMarketIndex ];
				var address= loc.address.replace('↵','<br />');
				$( '#location-section .results' ).empty().append( '<div class="result" style="opacity:1" data-name="' + loc.name + '"><h1>Apex Energy Solutions of ' + loc.name + '</h1><p>' + address + '</p><div class="btn myapex">Make This My Apex</div></div>' );
				$( '#location-section .myapex' ).off().on( 'click', function(){
					var newMarket = $( this ).parent().attr( 'data-name' );
					$.ajax({
						type: "POST",
						url: ajax_object.ajaxurl,
						data: {
							action: 'set_local_market', // this is wp_ajax_set_local_market hook
							market: newMarket
						},
						success: function( response ){
							locator.update( response );
						}
					} );
				} );
			}
		} else{
			// Not in a market, show the Franchise information
			$( '#location-section .results' ).empty().append( '<div class="result nomarket"><p>Bummer... there’s not currently an Apex within a ' + locator.marketRadius + '-mile radius of that location. Please try your search again, or visit our corporate contact page for more information.</p><p>The good news is we’re currently looking for local entrepreneurs to develop an Apex in your area. If you or someone you know might be interested, please visit our franchise page to learn more.</p><a href="/franchise"><div class="btn learn-more">Learn More</div></div>');
			// set corporate as local
			$.ajax({
				type: "POST",
				url: ajax_object.ajaxurl,
				data: {
					action: 'set_local_market', // this is wp_ajax_set_local_market hook
					market: 'Indianapolis, IN'
				}
			} );
		}
	},

	update: function( response ){
		locator.conceal();
		users_market = response;

		// Update header location information
		$( '#header #location' ).load( window.location.href + " #header #location p.phone, #header #location p.city, #header #location p.change", function(){
			locator.bindings();
		} );

		// Update the footer location information
		$( '#footer .locate' ).load( window.location.href + " #footer .locate h3, #footer .locate p.contactinfo, #footer .locate p.phones", '' );

		// Update the contact form
		var options = $( '#contact-section .contact-form .choice #market' ).next( '.options' );
		options.find( '.selected' ).removeClass( 'selected' );
		options.find( '.option' ).each( function(){
			if( $( this ).attr( 'data-value' ) == users_market ){
				$( this ).addClass( 'selected' );
				options.prev( '#market' ).text( $( this ).attr( 'data-value' ) );
			}
		} )

		// If this is the about page, update the testimonials at the footer
		if( $( '#content' ).attr( 'data-page' ) == 'about' ){
			var h = $( '#testimonials' ).height();
			$( '#testimonials' ).load( window.location.href + " #testimonials .container", function(){
				$( '#testimonials, #testimonials .testimonial' ).css( 'height', h );
				setTimeout( slider.init, 1000 );
			} );

		// If this is the contact page, update the contact information
		} else if( $( '#content' ).attr( 'data-page' ) == 'contact' ){
			$( '.white-overlay' ).css( { 'display': 'block' } );
			TweenLite.to( $( '.white-overlay' ), 0.5, { opacity: 1, onComplete: function(){
				// $( '.contact #small-hero' ).load( window.location.href + " .contact #small-hero .hero-image", '');
				$( '#contact_info ul' ).load( window.location.href + " #contact_info ul li.update", '');
				$( '#small-hero' ).load( window.location.href + " #small-hero .hero-image, #small-hero #hero-title",  function(){
					$( window ).load( $( '#small-hero .hero-image img' ).attr( 'src' ), function(){
						apex.swapState( $( '#hero-title h1' ).text() );
					} );
				} );
				$( '#map' ).load( window.location.href + " #map .cont #map-canvas, #map .map-overlay", '');
				TweenLite.to( $( '#map .map-overlay' ), 0.5, { opacity: 1, onComplete: function(){
					$( '#map' ).load( window.location.href + " #map .cont #map-canvas, #map .map-overlay", '');
					setTimeout( maps.init, 4000 );
				} } );
			} } );
		}

		if( $( '#accreditation' ).length > 0 ){
			$( '#accreditation' ).load( window.location.href + " #accreditation ul", function(){
				apex.centerAlign( $( '#accreditation ul li.logo' ), true );
			} );
		}
	},

	getClosestMarketInd: function( distances ){
		//make indexOf IE8 compatable
		if (!Array.prototype.indexOf){
			Array.prototype.indexOf = function(elt /*, from*/) {
				var len = this.length >>> 0;
				var from = Number( arguments[ 1 ] ) || 0;
				from = ( from < 0 ) ? Math.ceil( from ) : Math.floor( from );
				if ( from < 0 )
					from += len;
				for ( ; from < len; from++ ){
					if ( from in this && this[ from ] === elt )
						return from;
				}
				return -1;
			};
		}

		Array.min = function( array ){
			return Math.min.apply( Math, array );
		};

		var min = Array.min( distances )
		return distances.indexOf( min );
	},

	searchMarketsManual: function( SearchString ){
		if( SearchString != '' ){
			//get coords with zip
			var isState = false;
			for( var i = 0; i < states.length; i++ ){
				if( states[ i ]['label'].toLowerCase() == SearchString.toLowerCase() || states[ i ][ 'data' ].toLowerCase() == SearchString.toLowerCase() ){
					isState = true;
					locator.stateEntered( states[ i ][ 'data' ], states[ i ][ 'label' ] );
					break;
				}
				if( !isState && i == (states.length - 1) ){
					locator.getCoordFromZip( SearchString );
				}
			}
		} else {
			TweenLite.to($( '#location-section #loader'), 0.5, { delay: 1, opacity: 0, onComplete: function(){
				$( '#location-section #loader' ).css( 'display', 'none' );
			} } );
		}
	},

	stateEntered: function( abbr, state ){
		var checker = false;
		var marketsList = [];
		for( var m = 0; m < locator.francCoord.length; m++ ){
			if( locator.francCoord[ m ][ 'state' ].toLowerCase() == abbr.toLowerCase() ){
				marketsList.push( locator.francCoord[ m ] );
			}
			if( m == locator.francCoord.length - 1 ){
				if( !checker ){
					checker = true;
					$( '#location-section .results' ).empty();
					locator.addMarketsToView( marketsList );
				}
			}
		}
	},

	addMarketsToView: function( markets ){
		if( markets.length > 0 ){
			for( var j = 0; j < markets.length; j++ ){
				var loc = markets[ j ];
				var address= loc.address.replace('↵','<br />');
				$( '#location-section .results' ).append( '<div class="result" style="opacity:0" data-name="' + loc.name + '"><h1>Apex Energy Solutions of ' + loc.name + '</h1><p>' + address + '</p><div class="btn myapex">Make This My Apex</div></div>' );
			}

			TweenLite.to($( '#location-section #loader'), 0.5, { delay: 1, opacity: 0, onComplete: function(){
				$( '#location-section #loader' ).css( 'display', 'none' );
				TweenLite.to( $( '#location-section .results .result' ), 0.5, { opacity: 1 } );

				$( '#location-section .myapex' ).off().on( 'click', function(){
					var newMarket = $( this ).parent().attr( 'data-name' );
					$.ajax({
						type: "POST",
						url: ajax_object.ajaxurl,
						data: {
							action: 'set_local_market', // this is wp_ajax_get_all_markets hook
							market: newMarket
						},
						success: function( response ){
							locator.update( response );
						}
					} );
				} );
			} } );
		} else {
			// Not in a market, show the Franchise information
			$( '#location-section .results' ).append( '<div class="result nomarket" style="opacity:0;"><p>Bummer... there’s not currently an Apex within a ' + locator.marketRadius + '-mile radius of that location. Please try your search again, or visit our corporate contact page for more information.</p><p>The good news is we’re currently looking for local entrepreneurs to develop an Apex in your area. If you or someone you know might be interested, please visit our franchise page to learn more.</p><a href="/franchise"><div class="btn learn-more">Learn More</div></div>');

			TweenLite.to($( '#location-section #loader'), 0.5, { opacity: 0, onComplete: function(){
				$( '#location-section #loader' ).css( 'display', 'none' );
				TweenLite.to( $( '#location-section .results .result' ), 0.5, { opacity: 1 } );
			} } );

			// set corporate as local
			$.ajax({
				type: "POST",
				url: ajax_object.ajaxurl,
				data: {
					action: 'set_local_market', // this is wp_ajax_get_all_markets hook
					market: 'Indianapolis, IN'
				}
			} );
		}
	},

	getCoordFromZip:function( zip ){
		var dataReturned = false;
		var tempLat, tempLng;
		// Get the longitude and latitude from zip via GMaps API
		var url = 'https://maps.googleapis.com/maps/api/geocode/json?address={'+zip+'}';
		$.getJSON( url ).done( function( data ){
			// Update the User model with the zip code.
			if( data.results[ 0 ] ){
				tempLat = data.results[ 0 ].geometry.location.lat;
				tempLng = data.results[ 0 ].geometry.location.lng;
				dataReturned = true;
			} else {
				locator.disabledGeoHandler();
			}
		} ).fail( function( d, textStatus, error ) {
			locator.disabledGeoHandler();
		} ).complete( function(){
			if( dataReturned ){
				locator.userLocation = { lng: tempLng, lat: tempLat };
				locator.detLocalMarket( false );
				TweenLite.to($( '#location-section #loader'), 0.5, { opacity: 0, onComplete: function(){
					$( '#location-section #loader' ).css( 'display', 'none' );
					TweenLite.to( $( '#location-section .results .result' ), 0.5, { opacity: 1 } );
				} } );
			}
		} );
	},

	reveal: function(){
		var getMarket;
		TweenLite.to( $( 'body, html' ), 0.3, { scrollTop: 0, ease: Circ.easeOut } );
		$( '#location-section, #location-section .overlay, #location-section .location-fields, #location-section .results, #location-section .close-btn' ).css( 'display', 'block' );
		TweenLite.to( $( '#location-section .overlay' ), 0.5, { opacity: 0.85, onComplete: function(){
			TweenLite.to( $( '#location-section .location-fields, #location-section .results' ), 1, { opacity: 1, marginTop: '0px', ease:Circ.easeOut, onComplete: function(){
				locator.open = true;
			} } );
			TweenLite.to( $( '#location-section .close-btn' ), 0.5, { opacity: 1, onComplete: function(){
				$( '#location-section .close-btn' ).off().on( 'click', locator.conceal );
			} } );
		} } );

		$( '#location-section .location-fields #market_location' ).off('keypress').on( 'keypress', function( e ){
			// Get the field
			var element = $( this );

			// Clear the timeout
			clearTimeout( getMarket );
			
			// Show the loader gif
			TweenLite.to( $( '#location-section .results .result' ), 0.5, { opacity: 0 } );
			$( '#location-section #loader' ).css( 'display', 'block' );
			TweenLite.to($( '#location-section #loader'), 0.5, { opacity: 1 } );

			// After 2 seconds, get the data and display it. Basically we're waiting for the user to finish input.
			getMarket = setTimeout( function(){
				var currentValue = element .val();
				locator.searchMarketsManual( currentValue );
			}, 2000);


			if( e.which == 13 ){
				// Get the field
				var element = $( this );
				document.activeElement.blur();
				// Clear the timeout
				clearTimeout( getMarket );
				var currentValue = element.val();
				locator.searchMarketsManual( currentValue );
				return false;
			}
		} );
	},

	conceal: function(){
		$.ajax({
			type: "POST",
			url: ajax_object.ajaxurl,
			data: {
				action: 'set_user_visited'
			}
		} );
		$( '#location-section .close-btn' ).off();
		TweenLite.to( $( '#location-section .location-fields, #location-section .results' ), 1, { opacity: 0, marginTop: '-30px', ease:Circ.easeIn } );
		TweenLite.to( $( '#location-section .overlay' ), 0.5, { delay: 0.7, opacity: 0, onComplete: function(){
			locator.open = false;
			$( '#location-section .overlay, #location-section' ).css( 'display', 'none' );
		} } );
		TweenLite.to( $( '#location-section .close-btn' ), 0.5, { opacity: 0, onComplete: function(){
			$( '#location-section .close-btn' ).css( 'display', 'none' );
		} } );
	}
}
// $(document).ready(function(){
//   locator.autoLocate();
//   //locator.searchMarketsManual(46208);
// });
