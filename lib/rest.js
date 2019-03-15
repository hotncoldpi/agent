//https://www.npmjs.com/package/node-rest-client
var Client = require('node-rest-client').Client;
const Configstore = require('configstore');

module.exports = {

	getData : (user, pass, params, func) => {

		conf = new Configstore('agent');
		
		var options_auth = { 
			user: user, 
			password: pass,
			connection: { rejectUnauthorized:false }
		};
		
		var client = new Client(options_auth);
		
		var args = {
			parameters: params,
			headers: { "Content-Type": "application/json" }
		};
		
		var server = conf.get('server');
		if (server.indexOf('http') != 0) 
			server = 'https://' + server;
		client.get(server + "/WebApp/api/products/", args, function(data, response) {
			if (response.statusCode == 200) {
				if (func) 
					func(data, response);
			}
			else
				console.log(response.statusCode);
		});
		
	},

	putData : (user, pass, data, params, func, errorfunc) => {
		
		conf = new Configstore('agent');
		
		var options_auth = { 
			user: user, 
			password: pass,
			connection: { rejectUnauthorized:false }
		};
		
		var client = new Client(options_auth);
		
		var args = {
			data: data,
			parameters: params,
			headers: { "Content-Type": "application/json" }
		};

		var server = conf.get('server');
		if (server.indexOf('http') != 0) 
			server = 'https://' + server;
		client.put(server + "/WebApp/api/products/" + conf.get('id'), args, function(data, response) {
			if (response.statusCode == 200) {
				if (func) 
					func(data, response);
			}
			else {
				console.log(response.statusCode);
				if (errorfunc) 
					errorfunc(data, response);
			}
		});
	},
	
	postData : (user, pass, data, params) => {
		var options_auth = { 
			user: user, 
			password: pass,
			connection: { rejectUnauthorized:false }
		};
		
		var client = new Client(options_auth);
		
		var args = {
			data: data,
			parameters: params,
			headers: { "Content-Type": "application/json" }
		};

		//console.log("https://" + conf.get('server') + "/WebApp/api/products/")
		var server = conf.get('server');
		if (server.indexOf('http') != 0) 
			server = 'https://' + server;
		client.post(server + "/WebApp/api/products/", args, function(data, response) {
			if (response.statusCode == 200) {
				//TODO: move to func like putData above
				var id = data.id;
				if (id == null)
					id = data.Id;
				conf.set('id', id);
				handleId('id',id);
			}
			else
				console.log(response.statusCode);
		});
	}
};
