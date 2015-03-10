window.connectFour = window.connectFour || {};

connectFour.Model = (function() {
	"use strict";

	//Model constructor function

	var Model = function Model(config) {
		this.config = config;
		this.init();
		//...
	};

	//static consts

	Model.EVENTS = {
		INIT_COMPLETE: 'initComplete', // after connected to firebase
		INSERT_TOKEN: 'insertToken', // drop a piece
		GAME_OVER: 'gameOver', // a player wins, pass winning player as event parameter...
		GAME_ABORTED: 'gameAborted',
		STATE_CHANGE: 'stateChange',
		GAME_LIST_CHANGE: 'gameListChange',
		ERROR: 'error'
		//...
	};

	Model.STATES = {
		WAITING: 'waiting',
		PLAYING: 'playing',
		OVER: 'over'
	};


	//Model prototype

	Model.prototype = {

		//public properties

		state: Model.STATES.WAITING,
		currentPlayer: '',
		myPlayerIndex: '',
		columns: null,
		lastChangedColumn: null,
		gameList: null,
		numColumns: 7,

		//private properties

		_firebase: null,
		_firebaseGame: null,
		_gameId: '',

		//public functions

		init: function () {
			this._initColumns();
			this._firebase = new Firebase(this.config.firebaseUrl);
			this.gameList = new Firebase(this.config.firebaseUrl + '/games');
			this.numColumns = this.config.numColumns;
			this.watchGameListChange();
			$(this).triggerHandler(Model.EVENTS.INIT_COMPLETE);
		},

		reset: function() {
			this._firebaseGame.remove();
			this.init();
			this.lastChangedColumn = null;
		},

		toString: function () {
			var s = '';
			for (var row = 0; row < this.config.numRows; row++) {
				var line = '';
				for (var col = 0; col < this.config.numColumns; col++) {
					var elem = this.columns[col][row];
					line += (elem === undefined ? '-' : elem) + ' ';
				}
				s = line + '\n' + s;
			}
			return '\n' + s;
		},

		watchGameListChange: function() {
			var that = this
			this.gameList.on('value', function(snapshot) {
				$(that).triggerHandler(Model.EVENTS.GAME_LIST_CHANGE,snapshot);
			});
		},

		startGame: function (e) {
			if(this._firebaseGame){ // destroys firebasegame if allready existent
				this._firebaseGame.remove();
			}
			this._firebaseGame = this.gameList.push();
			this.myPlayerIndex = '1'
			this._firebaseGame.child('player/1').set({name: this.currentPlayer});
			this._firebaseGame.child('currentPlayerId').set({id: this.myPlayerIndex});
			this._firebaseGame.child('info').set({state: 'waiting'});		
			$(this).triggerHandler(Model.EVENTS.STATE_CHANGE);


			this.waitForPlayer();
			this.watchGameAbort(); //watches if another player exits game
			this._firebaseGame.onDisconnect().remove(); //when game is closed, remove game from data
		},

		waitForPlayer: function () {
			var that = this;
			this._firebaseGame.child('player').on('value', function(snapshot) {
				var players = snapshot.val();
				if(players && players['1'] && players['2']) {
					that._firebaseGame.child('player').off('value');
					that.onGameStart(that._firebaseGame);
				}
			});
		},

		joinGame: function(gameId) {

			if(!gameId) {
				return;
			}
			this._firebaseGame = new Firebase(this.config.firebaseUrl + '/games/' + gameId)
			var that = this;
			this._firebaseGame.once('value', function(snap) {
				
				var game = snap.val();
				if(game) {
					that._firebaseGame.child('info').transaction(function(currentData) {
						if(currentData && currentData.state == 'waiting') {	
							return {state: 'playing'};
						} else {
							return;
						}
					}, function(error, committed, snapshot) {
						if(error) {
							that._firebaseGame = null; // Sets null befor abortion, else, the game that this player is not part of will get aborted
							$(that).triggerHandler(Model.EVENTS.GAME_ABORTED);				
						}
						else if(!committed) {
							that._firebaseGame = null;
							$(that).triggerHandler(Model.EVENTS.GAME_ABORTED);
						} else {
							that.myPlayerIndex = '2';
							that._firebaseGame.child('player/2').set({name: that.currentPlayer});
							that.watchGameAbort();
							that._firebaseGame.onDisconnect().remove();
							that.onGameStart();
						}
					});

				} else {
					that._firebaseGame = null;
					$(that).triggerHandler(Model.EVENTS.GAME_ABORTED);
					console.log('game doesnt exist');
				}
			});
		},

		onGameStart: function () {
			this.watchGameMoves();
			this.state = Model.STATES.PLAYING;
			$(this).triggerHandler(Model.EVENTS.STATE_CHANGE);				

		},

		getPlayerNames: function () { // returns both names for labeling in the game view
			var names = [];
			this._firebaseGame.child('player').once('value',function(snap){
				var val = snap.val();
				names.push(val['1']['name'])
				if(typeof val['2'] != 'undefined') names.push(val['2']['name']);
				else names.push('Waiting...')
			});
			return names;
		},

		watchGameMoves: function () {
			var that = this
			this._firebaseGame.child('move').on('child_added', function(snapshot) {
				var val = snapshot.val();
				if(val['player'] != that.myPlayerIndex){
					that.columns[val['column']].push(val['player'])
					that.lastChangedColumn = val['column'];
					$(that).triggerHandler(Model.EVENTS.INSERT_TOKEN);
				}
			});
		},

		insertTokenAt: function (columnIndex) {
			if(!this.isInsertTokenPossibleAt(columnIndex)) return;
			var that = this;
			this._firebaseGame.child('currentPlayerId').transaction(function(currentData){
				if(currentData && currentData.id == that.myPlayerIndex){
					if(that.myPlayerIndex == '1'){
						return {id: '2'}
					} else {
						return {id: '1'}
					}
				} else {
					return;
				}
			},function(error, committed, snapshot){
				if(error) {
					console.log('abnormal error while inserting Token');
				}
				else if(!committed) {
					console.log('Not your turn.');
				} else {
					that.columns[columnIndex].push(that.myPlayerIndex);
					that.lastChangedColumn = columnIndex;
					that._firebaseGame.child('move').push({player: that.myPlayerIndex, column: columnIndex })
					$(that).triggerHandler(Model.EVENTS.INSERT_TOKEN);
				}
			});

		},

		lastTokenInserted: function () {
			if(this.lastChangedColumn){
				var x = this.lastChangedColumn;
				var y = this.columns[this.lastChangedColumn].length - 1;
				return [x,y];
			}
		},

		isInsertTokenPossibleAt: function (columnIndex) {
			return this.columns[columnIndex].length + 1 <= this.config.numRows;
		},

		watchGameAbort: function() {
			var that = this;
			this._firebaseGame.once('child_removed', function(test) {
				that._initColumns();
				$(that).triggerHandler(Model.EVENTS.GAME_ABORTED);
			});
		},

		onNameEntry: function (name) {
			this.currentPlayer = name;
		},

		isItMyTurn: function() {
			var itIs = false;
			var that = this;
			if(typeof this._firebaseGame != 'undefined'){
			this._firebaseGame.child('currentPlayerId').once('value',function(snap){
				if(snap.val().id == that.myPlayerIndex && that.state == Model.STATES.PLAYING) itIs = true;
			});
			}
			return itIs;
		},

		whatsAt: function(x,y) {
			var ret = this.columns[x][y]
			if(typeof ret == 'undefined') return ' '
			return ret 
		},

		coordToLocation: function(x,y) { // Calculates the position of the .token div in the #board so it cann be called via $('.token')[coordToLocation(x,y)]
			return (this.config.numColumns * this.config.numRows) - ( y * this.config.numColumns ) - ( this.config.numColumns - 1 - x ) - 1 + this.config.numColumns;
		},

		isGameOver: function() {
			var tempArray = [];
			$.extend(true, tempArray, this.columns)
			var that = this;
			var winner = false;

			var draw = true;

			tempArray.forEach(function(row){
				while(row.length < that.config.numRows){
					row.push(' ')
					draw = false;
				}
			});
			
			if(draw){
				$(that).triggerHandler(Model.EVENTS.GAME_OVER, [0, []]);
				return[0,[]];
			}

			var directions = [[1,0],[0,1],[1,1],[-1,1]] // Sets directions to search in. [x,y]

			var currentlyCounting = " ";
			var winningStones = [];
			var count = 0;

			for(var x = 0; x < this.config.numColumns; x++){
				for(var y = 0; y < this.config.numRows; y++){

					var token = this.whatsAt(x,y);
					if(token != " "){

						currentlyCounting = token;
						count = 1;
						winningStones = [this.coordToLocation(x,y)]

						for(var i = 0; i < directions.length; i++){ // Searches for every spot in every defined direction
							var tempX = x;
							var tempY = y;

							while(true){
								tempX += directions[i][0];
								tempY += directions[i][1];
								if(!(tempX >= 0 && tempX <= this.config.numColumns-1 && tempY >= 0 && tempY <= this.config.numRows-1)) break;

								if(this.whatsAt(tempX,tempY) == currentlyCounting){
									var location = this.coordToLocation(tempX,tempY)
									winningStones.push(location);
									count += 1;

									if(count >= this.config.maxLineLength){
										$(that).triggerHandler(Model.EVENTS.GAME_OVER, [currentlyCounting, winningStones]);
										return [currentlyCounting, winningStones];
									}

								} else {
									count = 1;
									var winningStones = [this.coordToLocation(x,y)]
									break;
								}
							}

						}

					}

				}
			}
			return false;
		},

		//private functions

		_initColumns: function () {
			this.columns = [];
			for(var i = 0; i < this.config.numColumns; i++)
				this.columns[i] = [];
		}


	};

	return Model;
})();