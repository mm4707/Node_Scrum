/**
 * @개요   : Node.js Server 
 * @파일명 : app.js
 * @작성자 : 마 민
 * @작성일 : 2017.05.25 
 */

var express = require('express')
 , session = require('express-session')
 , path = require('path')
 , favicon = require('serve-favicon')
 , cookieParser = require('cookie-parser')
 , bodyParser = require('body-parser')
 , mysql = require('mysql')
 , http = require('http')
 , app = express()
 , server = http.createServer(app)
 , io = require('socket.io')(server)
 , scrum = require('./routes/scrum.js');


var client = mysql.createConnection({
   user : 'root',
   password : 'root',
   database : 'project_asc'
});

var port = process.env.PORT || 4567;
/**
 * 환경설정
 */
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended : false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname,'public')));

app.get('/taskboard/:project_list_no/:sprint_no/:loginId', scrum.taskboard);
app.get('/releasePlanning/:project_list_no/:loginId', scrum.releasePlanning);

var rooms = {};
var project_room0;
var project_room1;
var project_room2;

io.sockets.on('connection', function (socket){
	
	/**
	 * 
	 */
	socket.on('join0', function(project_list_no){
		socket.project_list_no = project_list_no;
		
		project_room0 = project_list_no;
		
		socket.join(socket.project_list_no);
	});
	socket.on('join1', function(project_list_no, sprint_no){
		socket.sprint_no = sprint_no;
		
		project_room1 = socket.project_list_no+'/'+sprint_no;
		
		socket.join(socket.project_list_no+'/'+socket.sprint_no);
	});
	socket.on('join2', function(project_list_no, roomName){
		socket.roomName = roomName;
		
		project_room2 = socket.project_list_no+'/'+roomName;
		
		socket.join(socket.project_list_no+'/'+socket.roomName);
	});
	
	socket.on('disconnect',function(){
		socket.leave(socket.project_list_no);
		socket.leave(socket.project_list_no+'/'+socket.sprint_no);
		socket.leave(socket.project_list_no+'/'+socket.roomName);
	});
	
	/** 
	 * Sprint Start
	 * 현재 Sprint 종료 및 Sprint 추가 
	 */
	socket.on('sprintAdd', function (data){
		client.query('select max(sprint_no) as mad from sprint where scrum_no = ?', data.scrum_no
			,function (error, results){
				
				client.query('update sprint set end_date = now() where sprint_no = ?'
						, results[0].mad);
				
		});
		
		
	client.query('select project_name from project_list where project_list_no = ?',[data.project_release_no]
		,function (error, project_name){
		client.query('select name from users where user_no = ?', [data.loginId]
			,function (error, user_name){
			var content = '[' + project_name[0].project_name + '] ';
				content	+= user_name[0].name + ' : 태스크보드에서 스프린트 를 추가했습니다.';
			client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
				, [data.loginId, data.project_release_no, content]);
			
			client.query('INSERT INTO sprint(sprint_no, scrum_no, start_date) VALUES (null, ?, now())', data.scrum_no);
		});
	});
		
	client.query('select project_name from project_list where project_list_no = ?',[data.project_release_no]
		,function (error, project_name){
		client.query('select name from users where user_no = ?', [data.loginId]
			,function (error, user_name){
			client.query('select * from sprint_back_log where status <2 and sprint_no = ?', [data.sprint_no]
				, function (error, sprint_back){
				for(var i =0; i < sprint_back.length; i++){
				var content = '[' + project_name[0].project_name + '] ';
					content	+= user_name[0].name + ' : 스크럼에서 스프린트백로그 '+ sprint_back[i].content + ' 을(를) 다음 스프린트로 넘겼습니다.';
			
				client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
					, [data.loginId, data.project_release_no, content]);
				}
				
				client.query('select max(sprint_no) as mad from sprint where scrum_no = ?', data.scrum_no
					,function (error1, result){
					client.query('select count(sprint_back_log_no) as count from sprint_back_log where sprint_no = ? and status < 2',data.sprint_no
						,function (error, count){
						client.query('update sprint_back_log set sprint_no = ? where status < 2 and sprint_no = ?', [result[0].mad, data.sprint_no]
							,function (error2, sprint){
						
								//스프린트 추가시 투두 두잉 갯수 넘기기
								client.query('update sprint set do_count = ? where sprint_no = ?', [count[0].count, result[0].mad]);
								//스프린트 추가시 투두 두잉 갯수 넘기기
						
						
								io.sockets.in(project_room0).emit('sprintAdd', {
									max : result[0].mad
								});
						});
					});
				});
			});
		});
	});
	
		
	});
	/**
	 * 전체 Sprint 제거 및 Sprint 추가
	 */
	socket.on('sprintRemove', function (data){
		client.query('select project_name from project_list where project_list_no = ?',[data.project_release_no]
		,function (error, project_name){
		client.query('select name from users where user_no = ?', [data.loginId]
			,function (error, user_name){
			var content = '[' + project_name[0].project_name + '] ';
				content	+= user_name[0].name + ' : 태스크보드에서 스프린트를 전체 제거했습니다.';
			client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
				, [data.loginId, data.project_release_no, content]);

			client.query('delete from sprint where scrum_no = ?', data.scrum_no);
			});
		});
		
		client.query('select project_name from project_list where project_list_no = ?',[data.project_release_no]
		,function (error, project_name){
		client.query('select name from users where user_no = ?', [data.loginId]
			,function (error, user_name){
			var content = '[' + project_name[0].project_name + '] ';
				content	+= user_name[0].name + ' : 태스크보드에서 스프린트를 추가했습니다.';
			client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
				, [data.loginId, data.project_release_no, content]);

			client.query('insert into sprint (sprint_no, scrum_no, start_date) values(null, ?, now())', data.scrum_no
					,function (error, result0){
				client.query('select max(sprint_no) as mad from sprint where scrum_no = ?', data.scrum_no
						,function (error1, result){
					io.sockets.in(project_room0).emit('sprintRemove', {
						NewSprint : result[0].mad
					});
				});
			});
			});
		});
	});
	/**
	 * 현재 선택된 Sprint 시작 및 종료 날짜 보기
	 */
	socket.on('sprintDetail', function (data){
		client.query('select * from sprint where sprint_no = ?', data.sprint_no
			,function (error, results){
			socket.emit('sprintDetail', {
				sprint : results
			});
		});
	});
	/**
	 * Sprint Finish
	 */
	
	/**
	 * Category Start
	 * 전체 Category 리스트
	 */
	socket.on('categoryList', function (data){
		client.query('select * from category where scrum_no = ?', data.scrum_no 
			,function (error, results){
			io.sockets.in(project_room0).emit('categoryList', {
				data : results
		    });
		});
	});
	/**
	 * Category 추가
	 */
	socket.on('categoryAdd', function (data){
		client.query('select project_name from project_list where project_list_no = ?',[data.project_release_no]
			,function (error, project_name){
			client.query('select name from users where user_no = ?', [data.loginId]
				,function (error, user_name){
				var content = '[' + project_name[0].project_name + '] ';
					content	+= user_name[0].name + ' : 스크럼에서 카테고리 '+ data.title + ' 을(를) 추가했습니다.';
				client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
					, [data.loginId, data.project_release_no, content]);
				
				client.query('insert into category (category_no, project_release_no, scrum_no, title) values(null,?,?,?)'
						, [data.project_release_no, data.scrum_no, data.title]);
			});
		});
	});	
	/**
	 * Category 삭제
	 */
	socket.on('categoryDelete', function (data){
		
		client.query('select project_name from project_list where project_list_no = ?',[data.project_release_no]
			,function (error, project_name){
			client.query('select name from users where user_no = ?', [data.loginId]
				,function (error, user_name){
				client.query('select title from category where category_no = ?', [data.category_no]
					,function (error, title){	
					var content = '[' + project_name[0].project_name + '] ';
					content	+= user_name[0].name + ' : 스크럼에서 카테고리 '+ title[0].title + ' 을(를) 삭제했습니다.';
					
					client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
					, [data.loginId, data.project_release_no, content]);
					
					client.query('delete from category where category_no = ?'
					, data.category_no);
				});
			});
		});
		
	});
	/**
	 * Category 수정
	 */
	socket.on('categoryEdit', function (data){
		client.query('select project_name from project_list where project_list_no = ?',[data.project_release_no]
		,function (error, project_name){
		client.query('select name from users where user_no = ?', [data.loginId]
			,function (error, user_name){
				var content = '[' + project_name[0].project_name + '] ';
				content	+= user_name[0].name + ' : 스크럼에서 카테고리 '+ data.title + ' 을(를) 수정했습니다.';
				
				client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
				, [data.loginId, data.project_release_no, content]);
				
				client.query('update category set title = ? where category_no = ?'
				, [data.title, data.category_no]);
		});
	});
		
	});
	/**
	 * Category Finish
	 */
	
	/**
	 * UserStory Start
	 * 전체 UserStory 조회 
	 */
	socket.on('StoryList', function (data){
		client.query('select * from user_story where project_release_no = ?', data.project_release_no 
			,function (error, results){
				io.sockets.in(project_room0).emit('StoryList', {
					data : results
			    });
		});
	});
	/**
	 * UserStory 추가
	 */
	socket.on('StoryAdd', function (data){
		client.query('select project_name from project_list where project_list_no = ?',[data.project_release_no]
			,function (error, project_name){
			client.query('select name from users where user_no = ?', [data.loginId]
				,function (error, user_name){
				var content = '[' + project_name[0].project_name + '] ';
				content	+= user_name[0].name + ' : 태스크보드에서 유저스토리 '+ data.title + ' 을(를) 추가했습니다.';
				
				client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
				, [data.loginId, data.project_release_no, content]);
				
				client.query('INSERT INTO user_story(user_story_no, project_release_no, category_no, title, as_a, i_want, so_that, priority, working_time) values(null, ?, ?, ?, ?, ?, ?, ?, null)' 
				,[data.project_release_no, data.category_no, data.title, data.as_a,
				data.i_want, data.so_that, data.priority]);
			});
		});
	});
	/**
	 * UserStory 제거
	 */
	socket.on('StoryDelete', function (data){
		client.query('select project_name from project_list where project_list_no = ?',[data.project_release_no]
			,function (error, project_name){
			client.query('select name from users where user_no = ?', [data.loginId]
				,function (error, user_name){
				client.query('select title from user_story where user_story_no = ?', data.user_story_no
					,function (error, title){	
					var content = '[' + project_name[0].project_name + '] ';
					content	+= user_name[0].name + ' : 태스크보드에서 유저스토리 '+ title[0].title + ' 을(를) 삭제했습니다.';
				
					client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
					, [data.loginId, data.project_release_no, content]);
					
					client.query('delete from user_story where user_story_no = ?'		
					, data.user_story_no);
				});
			});
		});
	});
	/**
	 * UserStory 상세보기
	 */
	socket.on('StoryDetail', function (data){
		client.query('select * from user_story where user_story_no = ?'
			, data.user_story_no, function (error, results){
				io.sockets.in(project_room0).emit('StoryDetail', {
					data : results
				});
			});
	});
	/**
	 * UserStory 수정용 ->> 데이터 불러오기
	 */
	socket.on('ModifyStoryLoad', function (data){
		client.query('select * from user_story where user_story_no = ?'
				, data.user_story_no, function (error, results){
					io.sockets.in(project_room0).emit('ModifyStoryLoad', {
						data : results
					});
				});
	});
	/**
	 * UserStory 수정
	 */
	socket.on('StoryModify', function (data){
		
		client.query('select project_name from project_list where project_list_no = ?',[data.project_release_no]
			,function (error, project_name){
			client.query('select name from users where user_no = ?', [data.loginId]
				,function (error, user_name){
				client.query('select title from user_story where user_story_no = ?', data.user_story_no
					,function (error, title){	
					var content = '[' + project_name[0].project_name + '] ';
					content	+= user_name[0].name + ' : 태스크보드에서 유저스토리 '+ data.title + ' 을(를) 수정했습니다.';
			
					client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
					, [data.loginId, data.project_release_no, content]);
				
					client.query('update user_story set category_no = ?, title = ?, as_a = ?, i_want = ?, so_that = ?, priority = ? where user_story_no = ?'
					, [data.category_no, data.title, data.as_a, 
					data.i_want, data.so_that, data.priority, data.user_story_no]);
			});
		});
	});
	});
	/**
	 * UserStory 생성용 카테고리 리스트
	 */
	socket.on('StoryCateList', function (data){
		client.query('select * from category where scrum_no = ?', data.scrum_no 
				,function (error, results){
			socket.emit('StoryCateList', {
				data : results
			});
		});
	});
	/**
	 * UserStory 수정용 ->> 카테고리 리스트
	 */
	socket.on('ModifyStoryCate', function (data){
		client.query('select * from category where scrum_no = ?', data.scrum_no 
				,function (error, results){
			socket.emit('ModifyStoryCate', {
				data : results
			});
		});
	});
	/**
	 * UserStory 전용 ->> 카테고리 정보
	 */
	socket.on('StorycateDetail', function (data){
		client.query('select * from category where category_no = ?'
				, data.category_no, function (error, results){
					io.sockets.emit('StorycateDetail', {
						data : results
					});
				});
	});
	/**
	 * UserStory 작업시간 등록
	 */
	socket.on('StorySetScore', function (data){
		
		client.query('select project_name from project_list where project_list_no = ?',[data.project_release_no]
			,function (error, project_name){
			client.query('select name from users where user_no = ?', [data.loginId]
				,function (error, user_name){
				client.query('select title from user_story where user_story_no = ?', data.user_story_no
					,function (error, user_story){
					var content = '[' + project_name[0].project_name + '] ';
					content	+= user_name[0].name + ' : 릴리즈플래닝에서  '+ user_story[0].title + '의 플래닝포커를 결정했습니다.';
			
					client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
					, [data.loginId, data.project_release_no, content]);
			
					client.query('update user_story set working_time = ? where user_story_no = ?'
							, [data.working_time, data.user_story_no]);
			});
		});
	});
	});
	/**
	 * UserStory Finish
	 */
	
	/**
	 * Sprint_back_log Start
	 * 전체 Sprint_back_log 리스트
	 */
	socket.on('ToDoList', function (data){
		client.query('select * from sprint_back_log where sprint_no = ?' 
			,data.sprint_no,	function (error, results){
			io.sockets.in(project_room1).emit('ToDoList', {
				data : results
		    });
		});
	});
	/**
	 * Sprint_back_log 등록용 ->> 유저스토리 리스트
	 */
	socket.on('DoStory', function (data){
		client.query('select * from user_story where project_release_no = ? and working_time > 0', data.project_release_no 
			,function (error, results){
				socket.emit('DoStory', {
					data : results
				});
		});
	});
	/**
	 * Sprint_back_log 등록용 ->> 회원 리스트
	 */
	socket.on('DoUserList', function (data){
		client.query('select project_join_no from project_list where project_list_no = ?',[data.project_list_no]
			, function (error0, join){
			client.query('select user_no from project_join_list where project_join_no = ? and status = 0',[join[0].project_join_no]
				,function (error1, user){
				client.query('select * from users', function (error2, list){	
					socket.emit('DoUserList', {
						list : list,
						user : user
					});
				});
			});
		});
	});
	/**
	 * Sprint_back_log 등록
	 */
	socket.on('DoAdd', function (data){
		client.query('select project_name from project_list where project_list_no = ?',[data.project_release_no]
			,function (error, project_name){
			client.query('select name from users where user_no = ?', [data.loginId]
				,function (error, user_name){
				var content = '[' + project_name[0].project_name + '] ';
				content	+= user_name[0].name + ' : 태스크보드에서 스프린트 백로그 '+ data.content + ' 을(를) 추가했습니다.';
			
				client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
				, [data.loginId, data.project_release_no, content]);
				
				client.query('INSERT INTO sprint_back_log(sprint_back_log_no, sprint_no, user_story_no, user_no, content, status) values(null, ?, ?, ?, ?, 0)' 
				,[data.sprint_no, data.user_story_no, data.user_no, data.content]);
				
				//추가구간  스프린트 카운트 +1
				client.query('update sprint set do_count = do_count+1 where sprint_no = ?'
			    , [data.sprint_no]);
				//추가구간  스프린트 카운트 +1
			});
		});
	});
	/**
	 * Sprint_back_log 수정용 ->> 데이터 불러오기
	 */
	socket.on('DoModifyLoad', function (data){
		client.query('select * from sprint_back_log where sprint_back_log_no = ?'
				, data.sprint_back_log_no, function (error, results){
					socket.emit('DoModifyLoad', {
						data : results
					});
		});
	});
	/**
	 * Sprint_back_log 수정용 ->> 유저스토리 불러오기
	 */
	socket.on('DoModifyStory', function (data){
		client.query('select * from user_story where project_release_no = ? and working_time > 0', data.project_release_no 
			,function (error, results){
				socket.emit('DoModifyStory', {
					data : results
				});
		});
	});
	/**
	 * Sprint_back_log 수정용 ->> 유저 불러오기
	 */
	socket.on('DoModify_Worker', function (data){
		client.query('select project_join_no from project_list where project_list_no = ?',[data.project_list_no]
			, function (error0, join){
			client.query('select user_no from project_join_list where project_join_no = ? and status = 0',[join[0].project_join_no]
				,function (error1, user){
				client.query('select * from users', function (error2, list){	
					socket.emit('DoModify_Worker', {
					list : list,
					user : user
					});
				});
			});
		});
	});
	/**
	 * Sprint_back_log 수정
	 */
	socket.on('DoModify', function (data){
			client.query('select project_name from project_list where project_list_no = ?',[data.project_release_no]
			,function (error, project_name){
				client.query('select name from users where user_no = ?', [data.loginId]
				,function (error, user_name){
					var content = '[' + project_name[0].project_name + '] ';
					content	+= user_name[0].name + ' : 태스크보드에서 스프린트 백로그 '+ data.content + ' 을(를) 수정했습니다.';
					
					if(data.status != 2){
						client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
							, [data.loginId, data.project_release_no, content]);
					
						client.query('update sprint_back_log set user_story_no = ?, user_no = ?, content = ?, status = ?, done_date = null where sprint_back_log_no = ?'
							, [data.user_story_no, data.user_no, 
							data.content, data.status, data.sprint_back_log_no]);
					} else {
						client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
							, [data.loginId, data.project_release_no, content]);
						
						client.query('update sprint_back_log set user_story_no = ?, user_no = ?, content = ?, status = ?, done_date = now() where sprint_back_log_no = ?'
							, [data.user_story_no, data.user_no, 
							data.content, data.status, data.sprint_back_log_no]);
					}
				});
			});
	});
	/**
	 * Sprint_back_log 상세보기
	 */
	socket.on('ToDoDetail', function (data){
		client.query('select * from sprint_back_log where sprint_back_log_no = ?'
			, data.sprint_back_log_no, function (error, results){
				socket.emit('ToDoDetail', {
					data : results
				});
			});
	});
	/**
	 * Sprint_back_log 상세보기용 ->> 유저스토리 불러오기
	 */
	socket.on('DoDetail_UserStory', function (data){
		client.query('select * from user_story where user_story_no = ?'
				, data.user_story_no, function (error, results){
					socket.emit('DoDetail_UserStory', {
						data : results
					});
				});
	});
	/**
	 * Sprint_back_log 상세보기용 ->> 유저 불러오기
	 */
	socket.on('DoDetail_Worker', function (data){
		client.query('select * from users where user_no = ?'
				, data.user_no, function (error, results){
			socket.emit('DoDetail_Worker', {
				data : results
			});
		});
	});
	/**
	 * Sprint_back_log 드래그& 드랍 및 버튼으로 상태 변경
	 */
	socket.on('ThrowOut', function (data){
		client.query('select project_name from project_list where project_list_no = ?',[data.project_release_no]
		,function (error, project_name){
			client.query('select name from users where user_no = ?', [data.loginId]
			,function (error, user_name){
				client.query('select content from sprint_back_log where sprint_back_log_no =?', data.sprint_back_log_no
				,function (error, sprint_back){
					var content = '[' + project_name[0].project_name + '] ';
					content	+= user_name[0].name + ' : 태스크보드에서 스프린트 백로그 '+ sprint_back[0].content + ' 을(를) 수정했습니다.';
					if(data.status != 2){
				
						client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
							, [data.loginId, data.project_release_no, content]);
				
						client.query('update sprint_back_log set status = ?, done_date = null where sprint_back_log_no =?'
							, [data.status, data.sprint_back_log_no]);
					} else {
						client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
							, [data.loginId, data.project_release_no, content]);
						
						client.query('update sprint_back_log set status = ?, done_date = now() where sprint_back_log_no =?'
							, [data.status, data.sprint_back_log_no]);
					}
				});
			});
		});
	});
	/**
	 * Sprint_back_log 삭제
	 */
	socket.on('DoDelete', function (data){
		client.query('select project_name from project_list where project_list_no = ?',[data.project_release_no]
			,function (error, project_name){
			client.query('select name from users where user_no = ?', [data.loginId]
				,function (error, user_name){
				client.query('select content from sprint_back_log where sprint_back_log_no = ?', data.sprint_back_log_no
					,function (error, title){	
					var content = '[' + project_name[0].project_name + '] ';
					content	+= user_name[0].name + ' : 태스크보드에서 스프린트 백로그 '+ title[0].content + ' 을(를) 삭제했습니다.';
			
					client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
							, [data.loginId, data.project_release_no, content]);
				
					//삭제구간 스프린트 카운트 -1
					client.query('select sprint_no from sprint_back_log where sprint_back_log_no = ?',data.sprint_back_log_no
					,function (error, sprint){
						client.query('update sprint set do_count = do_count-1 where sprint_no = ?'
						, [sprint[0].sprint_no]);
					});
					//삭제구간 스프린트 카운트 -1
					
					client.query('delete from sprint_back_log where sprint_back_log_no = ?'		
							, data.sprint_back_log_no);
				});
			});
		});
	});
	/**
	 * Sprint_back_log Finish
	 */
	
	/**
	 * Release Planning Start
	 * Planning Poker Start
	 * Planning Poker 점수 등록
	 */
	socket.on('PokerAdd', function (data){
		client.query('select project_name from project_list where project_list_no = ?',[data.project_release_no]
			,function (error, project_name){
			client.query('select name from users where user_no = ?', [data.loginId]
				,function (error, user_name){
				client.query('select title from user_story where user_story_no = ?', data.user_story_no
					,function (error, user_story){
					var content = '[' + project_name[0].project_name + '] ';
					content	+= user_name[0].name + ' : 릴리즈플래닝에서  '+ user_story[0].title + '의 플래닝포커를 시행했습니다.';
				
					client.query('insert into log_list (log_list_no, user_no, project_list_no, content) values(null,?,?,CONCAT(?, "##", "(", DATE_FORMAT(NOW(),"%b %d %Y %h:%i %p"), ")" )  )'
						, [data.loginId, data.project_release_no, content]);
				
					client.query('insert INTO poker(poker_no, user_story_no, user_no, score) VALUES (null, ?, ?, ?)'
							, [data.user_story_no, data.user_no, data.score]);
				});
			});
		});
	});
	/**
	 * Planning Poker 상세보기
	 */
	socket.on('PokerDetail', function (data){
		client.query('select * from poker where user_story_no = ?'
				, data.user_story_no, function (error0, poker){
				client.query('select project_join_no from project_list where project_list_no = ?',[data.project_list_no]
					, function (error1, join){
					client.query('select user_no from project_join_list where project_join_no = ? and status = 0',[join[0].project_join_no]
						,function (error2, user){
						client.query('select * from users', function (error3, list){	
							socket.emit('PokerDetail', {
								poker : poker,
								user : user,
								list : list
							});
					});
				});
			});
		});
	});
	/**
	 * Planning Poker 상세보기
	 */
	socket.on('PokerFind', function (data){
		client.query('select * from poker where user_story_no = ? and user_no = ?', [data.user_story_no, data.user_no]
			,function (error, poker){
			socket.emit('PokerFind', {
				FindPoker : poker
			});
		});
	});
	/**
	 * Planning Poker Finish
	 */

	/**
	 * Project_Join_List Start
	 * Project_Join_List 참가 목록
	 */
	socket.on('Join_List', function (data){
		client.query('select count(user_no) as count from project_join_list where project_join_no = ?'
				, data.project_join_no, function (error, count){
					client.query('select count(user_no) as Vote from poker where user_story_no = ? and score >0'
							,data.user_story_no, function (error, vote){
								client.query('select * from poker where user_story_no = ? and score >0'
									,data.user_story_no, function (error, score){
										socket.emit('Join_List', {
											count : count,
											vote : vote,
											score : score
										});
								});	
					});
		});
	});
	/**
	 * Project_Join_List Finish
	 * Release Planning Finish
	 */
});

server.listen(port,function(){
	//서버시작;
});