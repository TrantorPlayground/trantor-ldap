 // BASE SETUP
 // =============================================================================

 // call the packages we need
 var express    = require('express'); 		// call express
 var app        = express(); 				// define our app using express
 var bodyParser = require('body-parser');
 var ActiveDirectory = require('activedirectory');
 var nconf = require('nconf');
 nconf.argv()
        .env()
        .file({ file: './config.json' });
 
 // configure app to use bodyParser()
 // this will let us get the data from a POST
 app.use(bodyParser.urlencoded({
   extended: true
 }));

 var port = process.env.PORT || 8080; 		// set our port

 var ldapServerAddress = "ldap://" + nconf.get('ldapServerAddress');

 var adInstances = {};
 var getADInstance = function(req){
 	var user = req.headers["user"];
 	var pass = req.headers["pass"];
	
 	var ad = adInstances[user + "|" + pass];
 	if(ad === null || typeof ad === 'undefined'){
 		ad = new ActiveDirectory(
 			{ 
 				url: ldapServerAddress,
 				 baseDN: 'dc=trantorchd,dc=com', 
 				 username: user,
 				 password: pass,
 				 attributes: {
 				     user: [ 
 				       'userPrincipalName', 'sAMAccountName', 'manager', 'mail',
 				       'lockoutTime', 'whenCreated', 'pwdLastSet', 'userAccountControl',
 				       'employeeID', 'sn', 'givenName', 'initials', 'cn', 'displayName',
 				       'comment', 'description', 'directReports' 
 				     ],
 				     group: [
 				       'objectCategory',
 				       'distinguishedName',
 				       'cn',
 				       'description',
 				       'member'
 				     ]
 				 } 
 			 }
 		 );
 		 adInstances[user + "|" + pass] = ad;
 	}
 	return ad;
 };

 // ROUTES FOR OUR API
 // =============================================================================
 var router = express.Router(); 				// get an instance of the express Router
 
 // middleware to use for all requests
 router.use(function(req, res, next) {
 	// Middleware
	
	// Allow CORS
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");

	// Authenticate request
	var ad = getADInstance(req);
	var user = req.headers["user"];
	var pass = req.headers["pass"];
	
    ad.authenticate(user, pass, function(err, auth) {
      if (err) {
		res.json(401, { error: err });	
      } else {
	      if (auth) {
			next(); // make sure we go to the next routes and don't stop here
	      }
	      else {
	        console.log('Authentication failed!');
			res.json(401, { error: err });	
	      }
      }
    });
 });
 var findLDAPUser = function(query, req, res){
 	 var ad = getADInstance(req);
	 ad.findUsers(query, true, function(err, users) {
	   if (err) {
		   res.json(422, {error: err});	
	   } else {
		   ((! users) || (users.length == 0)) ? res.json({}): res.json(users[0]);	
	   }
	 });
 };
 
 // test route to make sure everything is working (accessed at GET http://localhost:8080/api)
 router.get('/', function(req, res) {
	 findLDAPUser(req.query.search_params, req, res);
 });
 
 router.get('/authenticate', function(req, res){
 	res.json({success: "You are authenticated"});
 })
 
 router.get('/users/:id', function(req, res) {
 	 findLDAPUser("description=" + req.params.id, req, res);
 });
 
 router.get('/users/:id/manager', function(req, res) {
 	 var ad = getADInstance(req);
	 ad.findUsers("description=" + req.params.id, true, function(err, users) {
	   if (err) {
		   res.json(422, {error: err});	
	   } else {
		   if ((! users) || (users.length == 0)){
			   res.json({});
		   } else {
			   var user = users[0];
			   findLDAPUser("distinguishedName="+ user.manager, req, res);
		   }	
	   }
	 });
 });
 
 router.get('/users/:id/direct-reports', function(req, res) {
 	res.json(500, {error: "API under construction"});	
 });
 
 router.post('/email', function(req, res){
 	res.json(500, {error: "API under construction"});	
 });

 // more routes for our API will happen here

 // REGISTER OUR ROUTES -------------------------------
 // all of our routes will be prefixed with /api
 app.use('/api', router);
 
 // START THE SERVER
 // =============================================================================
 app.listen(port);
 console.log('Magic happens on port ' + port);
 