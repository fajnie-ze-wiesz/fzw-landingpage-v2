var ajax = function (settings) {
	var defaults = {
		url: "",
		method: "post",
		data: null,
		success: function (response, request) {
		},
		error: function (response, request) {
		}
	};
	
	settings = Object.assign(defaults, settings);
	
	// Feature detection
	if (!window.XMLHttpRequest)
		return;
	
	// Create new request
	var request = new XMLHttpRequest();
	
	// Setup callbacks
	request.onreadystatechange = function () {
		// If the request is complete
		if (request.readyState === 4) {
			// If the request failed
			if (request.status !== 200) {
				if (settings.error && typeof settings.error === "function") {
					settings.error(request.responseText, request);
				}
				return;
			}
			
			// If the request succeeded
			if (settings.success && typeof settings.success === "function") {
				settings.success(request.responseText, request);
			}
		}
	};
	
	request.open(settings.method, settings.url);
	
	if (settings.data) {
		request.send(JSON.stringify(settings.data));
	} else {
		request.send();
	}
};