window.connectFour = window.connectFour || {};

connectFour.game = (function(config, Model) {
	"use strict";

	var model = null;
	var currentPlayer = 0;
	var winnerStones = [];
	//...

	function reset() {
		currentPlayer = 1;
		winnerStones = [];
		var tempPlayerName = model.currentPlayer;
		model.reset();
		model.onNameEntry(tempPlayerName);
	}

	function init() {
		//context = document.getElementById("gameBoard").getContext("2d");

		model = new Model(config);
		currentPlayer = 1;

		$(model).on(Model.EVENTS.GAME_LIST_CHANGE, onGameListChange);
		$(model).on(Model.EVENTS.GAME_OVER, onGameOver);
		$(model).on(Model.EVENTS.GAME_ABORTED, onGameAborted);
		$(model).on(Model.EVENTS.STATE_CHANGE, onStateChange);
		$(model).on(Model.EVENTS.INSERT_TOKEN, onInsertToken);

		watchInput()

		$(window).on('resize',function(e){ // Makes sure board is the right size after browser resize.
			renderBoard();
		});

	}

	function watchInput(){ // Alters the kuro input field to close once a name has been saved
		$('.input__label-content').parent().append('<span class="input__label-content input__label-content--kuro newLabel">Name saved</span>')
    
    $(window).on('click',function(e){
      $('#enterNameForm').trigger('submit');
    })

    $('.input__field--kuro').on('click',function(e){
    	e.stopPropagation();
    })


		$('#enterNameForm').on('submit',function(e){ // Also handles the name submit
			e.preventDefault();
			var val = e.target[0].value;
			if(val.length > 0){				
				$('.oldLabel').css('width','0%');
				$('.newLabel').css('width','100%');
				$('.input__field--kuro').attr('disabled',true);
				$('.input--kuro').addClass('input--close');
				model.onNameEntry(e.target[0].value);
			}
		});

		$('#startGame').on('submit',function(e){ // and it handles the start game form
			e.preventDefault();
			if(checkNameEntered()){
				model.startGame();
				$('#holder').css('margin-left','-100vw');
				lightBoxOn('Waiting for another player...');
			}
		});
	}

	function checkNameEntered(){ // Makes sure that a name has been entered. Is so it returns true;
		if(model.currentPlayer == ""){
			$('#enterNameForm').addClass('wiggle');
			setTimeout(function(){
				$('#enterNameForm').removeClass('wiggle');
			}, 550);
			return false;
		}
		return true;
	}

	function onInsertToken(){
		renderBoard();
		model.isGameOver();
		toggleCurrentPlayer();
	}

	function toggleCurrentPlayer(){
		if(currentPlayer == 1){
			$('#playerOneName').parent().removeClass('currentPlayer');
			$('#playerOneName').parent().removeClass('wiggle');
			$('#playerTwoName').parent().addClass('currentPlayer');
			$('#playerTwoName').parent().addClass('wiggle');
			currentPlayer = 2;
		} else {
			$('#playerOneName').parent().addClass('currentPlayer');
			$('#playerOneName').parent().addClass('wiggle');
			$('#playerTwoName').parent().removeClass('currentPlayer');
			$('#playerTwoName').parent().removeClass('wiggle');
			currentPlayer = 1;
		}
	}

	function onStateChange(e){ // Adds the players names to the display when game starts
		var state = model.state
		if(state == 'playing'){
			$('#playerOneName').parent().addClass('currentPlayer');
			lightBoxOff();
		}

		var names = model.getPlayerNames();
		$('#playerOneName').html(names[0]);
		$('#playerTwoName').html(names[1]);
		renderBoard();
	}

	function onGameAborted(e) {
		lightBoxOn('The game has been aborted.')
		animateEmptyBoard();
		setTimeout(function(){
			moveToHomeScreen();
			reset();
			lightBoxOff();
		}, 2000)
	}

	function onGameOver(e, winner, winningStones) { // Marks the winning combination, displays winning message and returns to home screen
		markWinners(winningStones)
		var winnerMessage;
		if(winner == 1){
			winnerMessage = 'Player ' + $('#playerOneName').html() + ' has won!';
		} else if(winner == 2) {
			winnerMessage = 'Player ' + $('#playerTwoName').html() + ' has won!';
		} else {
			winnerMessage = 'The game ended in a draw.';
		}
		setTimeout(function(){
			lightBoxOn(winnerMessage)
			animateEmptyBoard();
			setTimeout(function(){
				moveToHomeScreen();
				reset();
			}, 2000);
		}, 2000);
	}

	function markWinners(winningStones) {
		$('#board .spot .token').addClass('loser');
		var $tokens = $('.token');
		winnerStones = winningStones;
		winningStones.forEach(function(stone){
			$($tokens[stone]).removeClass('loser');
		});	
	}

	function moveToHomeScreen() {
		lightBoxOff();
		$('#holder').css('margin-left','0vw');
	}

	function renderBoard() { // Calculates size of spots/tokens and fills the #board element with divs in the correct size
		var $board = $('#board');
		$board.empty();
		var board = model.toString().replace(/\n/g,'').split(' ');

		for(var i = 0; i< model.numColumns; i++){ // Spots where the tokens can be droped
			$board.append('<div class="spot"><div class="token insertSpot" id="' + i + '"></div></div>');
		}

		board.forEach(function(spot){
			var token = "x";
			if( spot == "1" ) token = "a";
			if( spot == "2" ) token = "b";

			if(spot.length > 0){ // Actual spots with player-according colours
				$board.append('<div class="spot"><div class="token  ' + token + ' "></div><img src="assets/img/tile.png"></div>');
			}

		});

		var spotWidth = getSpotWidth()  + 'px';
		$('.spot').css('width',spotWidth);
		$('.spot').css('height',spotWidth);

		addBoardListeners();

		if(winnerStones.length > 0){ // Mark Winning stones also after resize
			markWinners(winnerStones);
		}
		animateLastToken();
	}

	function addBoardListeners(){ // Adds listeners to the insert spots only if its the players turn
		if(model.isItMyTurn()){
			$('.insertSpot').on('mouseover',function(e){
				if(model.myPlayerIndex == '1'){
					$(e.target).addClass('a');				
				} else {
					$(e.target).addClass('b');				
				}
			});

			$('.insertSpot').on('mouseout',function(e){
				if(model.myPlayerIndex == '1'){
					$(e.target).removeClass('a');				
				} else {
					$(e.target).removeClass('b');				
				}
			});

			$('.insertSpot').on('click',function(e){
				model.insertTokenAt(e.target.id)
			});			
		}		
	}

	function animateLastToken(){ // Adds the animation for the last inserted token
		if(model.lastChangedColumn){	// This check prevents the animation beeing executed on every resize;
			var coord = model.lastTokenInserted();
			var pos = model.coordToLocation(coord[0],coord[1]);
			var $token = $($('.token')[pos]);
			var climbedRows = model.config.numRows - coord[1];

			$token.css('position','relative');			
			$token.css('z-index','-1');	
			$token.css('top','-' + (climbedRows * getSpotWidth()) + 'px');	
			$token.addClass('dropAnimation');

			model.lastChangedColumn = null;
		}
	}

	function animateEmptyBoard() { // Animates all tokens falling out of the board.
		var lowestIndex = model.config.numColumns;
		var highestIndex = model.config.numColumns * model.config.numRows - 1 + model.config.numColumns;
		var $tokens = $('.token');
		for(var i = highestIndex ; i >= lowestIndex; i-- ){
			$($tokens[i]).css('webkit-animation-delay', Math.floor((Math.random() * 5) + 1) + '0ms');
			$($tokens[i]).addClass('falling');
		}
	}

	function getSpotWidth(){
		return ($('#board').width() / model.numColumns)-1;
	}

	function lightBoxOn(message){
		$('.darken').css('opacity','1');
		$('.darken').css('pointer-events','inherit');
		if(typeof message != 'undefined') $('.darken .lightBox #message').html(message);
	}

	function lightBoxOff(){
		$('.darken').css('opacity','0');
		$('.darken').css('pointer-events','none');		
	}

	function onGameListChange(e,snap) { // Clears then adds to the #gameList every game that is waiting
 		$('#gameList').empty();

		var games = snap.val();
		snap.forEach(function(game){
				var val = game.val();
			if(game.numChildren() == 3 && val['info']['state'] == 'waiting'){
 				var gameId = game.key();

				var startPlayerName = val['player']['1'];
				var startPlayerId = val['currentPlayerId']['id'];

				$('#gameList').append('<p class="openGame">' + startPlayerName['name'] + '<span class="join pull-right" id="'+ gameId +'"> Join!</a></p>');
			}			
		});
		addJoinGameListeners()
	}

	function addJoinGameListeners(){
		$('.join').on('click',function(e){
			e.preventDefault();
			if(checkNameEntered()){
				var id = e.target.id;
				model.joinGame(id);
				$('#holder').css('margin-left','-100vw');
			}
		});
	}

	init();

}(connectFour.CONFIG, connectFour.Model));