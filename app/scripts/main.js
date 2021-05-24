window.app = {
	lazyload: function () {
		var bgs = new LazyLoad({
			elements_selector: ".lazy:not(.loaded)",
			callback_load: function (e) {
				if (e.classList.contains("lazy--bg")) {
					var src = typeof e.currentSrc !== "undefined" ?
						e.currentSrc :
						e.src;
					if (e.src !== e.parentNode.dataset.src) {
						e.parentNode.dataset.src = src;
						e.parentNode.style.backgroundImage = "url(\"" + src + "\")";
					}
				}
			}
		});
	},
	
	cookies: function() {
		if (Cookies.get('cookies') != "true") {
			app.cookiesbar = document.getElementsByClassName("cookie-bar")[0];
			app.cookiesbar.style.display = 'block';
		}

		document.addEventListener('click', function (event) {
			if (!event.target.matches('.close-cookie')) return;
			event.preventDefault();
			app.cookiesbar.style.display = 'none';
			Cookies.set('cookies', true, {
				path: '/',
				secure: false,
				domain: '',
				expires: 30
			 });
		}, false);
	},

	anchors: function() {
		document.querySelectorAll('.scroll-to').forEach(function(anchor) {
			anchor.onclick = function(e) {
				e.preventDefault()
				var href = anchor.getAttribute('href'),
					target = document.querySelector(href),
					to = target.offsetTop - 80;
				scrollTo(document.documentElement, to, 500);
			}
		})
  
		var scrollTo = function(element, to, duration) {
			var start = element.offsetTop,
				change = to - start,
			 	currentTime = 0,
				increment = 20;


			var animateScroll = function() {
				currentTime += increment;
				var val = easeInOutQuad(currentTime, start, change, duration);
				element.scrollTop = val;
				if (currentTime < duration) {
					setTimeout(animateScroll, increment);
				}
			}

			animateScroll()
		}
  
		var easeInOutQuad = function(t, b, c, d) {
			t /= d / 2
			if (t < 1) return c / 2 * t * t + b
			t--
			return -c / 2 * (t * (t - 2) - 1) + b
		}
	},

	menu: function(){
		const menu = new MmenuLight(
			document.querySelector( "#menu" )
		);
		const navigator = menu.navigation();
		const drawer = menu.offcanvas();
		const hamburger = document.querySelector( ".hamburger" )
	
		document.querySelector( 'a[href="#menu"]' ).addEventListener('click', (evnt) => {
			evnt.preventDefault();
			drawer.open();
			hamburger.classList.add('is-active');
		});

		const observer = new MutationObserver((mutationsList, observer) => {
			for(let mutation of mutationsList) {
				if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
					if(!document.body.classList.contains("mm-ocd-opened")) {
						hamburger.classList.remove('is-active');	
					}
				}
			}
		});
		
		observer.observe(document.body, { attributes: true });
	},

	init: function() {
		app.lazyload();
		app.cookies();
		app.anchors();
		app.menu();
		var rellax = new Rellax('.rellax');
	}
};

document.addEventListener("DOMContentLoaded", function () {
	app.init();
});