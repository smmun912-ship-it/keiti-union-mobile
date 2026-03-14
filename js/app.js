// 전역 모달 컨트롤 함수 (HTML inline onclick 사용)
window.openModal = function(id) {
    document.getElementById(id).classList.add('active');
}
window.closeModal = function(id) {
    document.getElementById(id).classList.remove('active');
}
window.showAlert = function(msg) {
    document.getElementById('alert-message').innerText = msg;
    openModal('alert-modal');
}

document.addEventListener('DOMContentLoaded', () => {
    // === DOM 요소 ===
    const loginView = document.getElementById('login-view');
    const mainView = document.getElementById('main-view');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('btn-submit-signup');
    const addPostBtn = document.getElementById('btn-submit-post');
    const fabBtn = document.querySelector('.fab-btn');

    // === 상태 변수 ===
    // 현재 세션의 유저 정보
    let currentUser = null; 
    let currentUserName = "조합원";

    // === Firebase 연동이 안되어있을 때를 대비한 목업 데이터 ===
    let mockPosts = [
        { title: "식당 메뉴 관련 설문조사 언제까지인가요?", author: "이지은", date: "2026.03.10", views: 88 },
        { title: "이번 주말 등산동호회 일정 문의", author: "박철수", date: "2026.03.13", views: 45 },
        { title: "휴게실 환경 개선 건의합니다.", author: "김영희", date: "2026.03.14", views: 12 }
    ];

    // ----------------------------------------------------
    // 1. 회원가입 로직 (Firebase Auth & Firestore)
    // ----------------------------------------------------
    if (signupBtn) {
        signupBtn.addEventListener('click', async () => {
            const id = document.getElementById('regId').value;
            const name = document.getElementById('regName').value;
            const role = document.getElementById('regRole').value;
            const pw = document.getElementById('regPw').value;

            if(!id || !name || !role || pw.length < 6) {
                showAlert("직위를 포함한 모든 항목을 입력하고, 비밀번호는 6자리 이상 설정해주세요.");
                return;
            }

            // [Firebase Mode]
            if (window.keitiFirebase && window.keitiFirebase.isInit) {
                try {
                    // Firebase Auth는 Email 형식을 요구하므로 사번을 이메일로 가공
                    const email = `${id}@keiti-union.test.com`;
                    const fb = window.keitiFirebase;
                    
                    const userCredential = await fb.createUserWithEmailAndPassword(fb.auth, email, pw);
                    const user = userCredential.user;

                    // 특별 하드코딩: 특정 사번은 자동 관리자 승인 (문성만 님 계정)
                    let status = "pending";
                    let finalName = name;
                    
                    if (id === "216008") {
                        status = "approved"; // 관리자 권한 즉시 부여
                    }

                    // 직위 기반 관리자 여부 확인
                    const isAdminRole = (role === '위원장' || role === '부위원장' || role === '사무처장');

                    // Firestore에 회원 정보 저장
                    await fb.setDoc(fb.doc(fb.db, "users", user.uid), {
                        empId: id,
                        name: finalName,
                        role: role,
                        isAdmin: isAdminRole,
                        status: status, // admin이 나중에 'approved'로 변경해야 로그인 가능 (216008 제외)
                        createdAt: fb.serverTimestamp()
                    });

                    // 가입 즉시 로그인되지 않도록 바로 로그아웃 처리 (일반 유저)
                    await fb.signOut(fb.auth);

                    closeModal('signup-modal');
                    
                    if (status === "approved") {
                        showAlert("관리자 계정 등록이 완료되었습니다. 이제 바로 로그인하실 수 있습니다.");
                    } else {
                        showAlert("가입 신청이 완료되었습니다. 관리자 승인 후 로그인 가능합니다.");
                    }
                    
                } catch (error) {
                    console.error(error);
                    showAlert("가입 중 오류가 발생했습니다: " + error.message);
                }
            } else {
                // [UI Mock Mode]
                closeModal('signup-modal');
                showAlert("[테스트 모드] 가입 신청 완료! (관리자 승인 대기)");
            }
        });
    }

    // ----------------------------------------------------
    // 2. 로그인 로직 (Firebase Auth & Firestore 승인 체크)
    // ----------------------------------------------------
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const id = document.getElementById('userId').value;
            const pw = document.getElementById('userPw').value;
            
            if(!id || !pw) {
                showAlert('사번과 비밀번호를 올바르게 입력해주세요.');
                return;
            }

            loginBtn.innerText = "로그인 중...";

            // [Firebase Mode]
            if (window.keitiFirebase && window.keitiFirebase.isInit) {
                try {
                    const email = `${id}@keiti-union.test.com`;
                    const fb = window.keitiFirebase;
                    
                    const userCredential = await fb.signInWithEmailAndPassword(fb.auth, email, pw);
                    const user = userCredential.user;

                    // Firestore에서 유저 상태(승인 여부) 확인
                    const userDoc = await fb.getDoc(fb.doc(fb.db, "users", user.uid));
                    
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        
                        // 하드코딩된 216008 계정은 DB 상태와 무관하게 무사 통과
                        if (id === "216008" || userData.status === 'approved') {
                            currentUser = userData;
                            // 과거 가입으로 DB에 role/isAdmin 이 없는 경우 강제 부여
                            if (id === "216008") {
                                currentUser.role = currentUser.role || "사무처장";
                                currentUser.isAdmin = true;
                            }
                            
                            currentUserName = userData.name || id; // 이름 fallback
                            enterMainView();
                            loadBoardPosts(); // 뷰 전환 후 게시글 로드
                        } else {
                            // 승인 대기
                            await fb.signOut(fb.auth);
                            showAlert("아직 관리자 승인 대기 중입니다. 승인 후 이용해주세요.");
                        }
                    } else {
                        // DB에 문서가 없어도 특별 계정인 경우 무사 통과
                        if (id === "216008") {
                            currentUser = { empId: "216008", name: "관리자", role: "사무처장", isAdmin: true, status: "approved" };
                            currentUserName = "관리자";
                            enterMainView();
                            loadBoardPosts();
                        } else {
                            await fb.signOut(fb.auth);
                            showAlert("회원 정보를 찾을 수 없습니다.");
                        }
                    }
                } catch(error) {
                    console.error(error);
                    showAlert("로그인 실패. 사번이나 비밀번호를 확인해주세요.");
                } finally {
                    loginBtn.innerText = "노조원 로그인";
                }
            } else {
                // [UI Mock Mode] 무조건 통과 (테스트 뷰어용)
                currentUserName = id === 'admin' ? '관리자' : '체험자';
                enterMainView();
                renderMockPosts();
                loginBtn.innerText = "노조원 로그인";
            }
        });
    }

    function enterMainView() {
        // 홈 화면 이름 업데이트
        const heroName = document.querySelector('.hero-text h2 strong');
        if(heroName) heroName.innerText = currentUserName;

        loginView.style.opacity = '0';
        setTimeout(() => {
            loginView.classList.remove('active');
            mainView.classList.add('active');
        }, 400); 
    }

    // ----------------------------------------------------
    // 3. 네비게이션 탭 동작
    // ----------------------------------------------------
    const navItems = document.querySelectorAll('.nav-item');
    const sections = {
        'home': document.getElementById('section-home'),
        'board': document.getElementById('section-board'),
        'download': document.getElementById('section-download'),
        'myinfo': document.getElementById('section-myinfo')
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');
            if(!target || !sections[target]) return;

            // 라우팅 활성화 UI 반전
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // 섹션 교체
            Object.values(sections).forEach(sec => {
                if(sec) {
                    sec.style.display = 'none';
                    sec.classList.remove('fade-in');
                }
            });
            
            sections[target].style.display = 'block';
            setTimeout(() => {
                sections[target].classList.add('fade-in');
            }, 10);

            // 내 정보 탭 열릴 때 데이터 바인딩
            if (target === 'myinfo') {
                renderMyInfo();
            }
        });
    });

    // --- 내 정보 & 로그아웃 & 승인 로직 ---
    const btnLogout = document.getElementById('btn-logout');
    if(btnLogout) {
        btnLogout.addEventListener('click', async () => {
            if(window.keitiFirebase && window.keitiFirebase.isInit) {
                await window.keitiFirebase.signOut(window.keitiFirebase.auth);
            }
            currentUser = null;
            currentUserName = "조합원";
            mainView.classList.remove('active');
            loginView.style.opacity = '1';
            loginView.classList.add('active');
            navItems[0].click(); // 로그아웃 시 홈 탭으로 리셋
        });
    }

    async function renderMyInfo() {
        if(!currentUser) return;
        document.getElementById('info-name').innerText = currentUser.name || "이름없음";
        document.getElementById('info-id').innerText = currentUser.empId || "사번안내됨";
        document.getElementById('info-role').innerText = currentUser.role || "조합원";

        const adminSection = document.getElementById('admin-pending-section');
        const pendingList = document.getElementById('pending-users-list');
        
        // 관리자 직위일 경우 특별 권한 렌더링
        if(currentUser.isAdmin) {
            adminSection.style.display = 'block';
            
            // Firebase에서 pending 유저 가져오기
            if(window.keitiFirebase && window.keitiFirebase.isInit) {
                const fb = window.keitiFirebase;
                try {
                    const q = fb.query(fb.collection(fb.db, "users"));
                    const querySnapshot = await fb.getDocs(q);
                    pendingList.innerHTML = '';
                    let hasPending = false;

                    querySnapshot.forEach((docSnap) => {
                        const data = docSnap.data();
                        if(data.status === 'pending') {
                            hasPending = true;
                            // 관리자 승인 버튼 렌더링
                            const userItem = `
                                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
                                    <div>
                                        <div style="font-weight:bold; font-size:14px; color:var(--text-main);">${escapeHtml(data.name)} <span style="font-size:12px; color:var(--text-secondary); font-weight:normal;">(${escapeHtml(data.role)})</span></div>
                                        <div style="font-size:12px; color:var(--text-light); margin-top:4px;">사번: ${escapeHtml(data.empId)}</div>
                                    </div>
                                    <button class="btn btn-primary" style="padding:6px 14px; font-size:12px;" onclick="approveUser('${docSnap.id}')">승인하기</button>
                                </div>
                            `;
                            pendingList.insertAdjacentHTML('beforeend', userItem);
                        }
                    });

                    if(!hasPending) {
                        pendingList.innerHTML = '<div style="padding: 20px; text-align:center; color:#999;">승인 대기 중인 사용자가 없습니다.</div>';
                    }
                } catch(err) {
                    console.error("대기자 목록 불러오기 실패", err);
                }
            } else {
                pendingList.innerHTML = '<div style="padding: 20px; text-align:center; color:#999;">(테스트 모드) 승인 기능은 Firebase 연동 시 활성화됩니다.</div>';
            }
        } else {
            adminSection.style.display = 'none';
        }
    }

    // 전역 승인 함수 노출
    window.approveUser = async function(docId) {
        if(!confirm("이 사용자의 가입을 승인하시겠습니까?")) return;

        if(window.keitiFirebase && window.keitiFirebase.isInit) {
            const fb = window.keitiFirebase;
            try {
                await fb.setDoc(fb.doc(fb.db, "users", docId), { status: 'approved' }, { merge: true });
                showAlert("승인 완료되었습니다.");
                renderMyInfo(); // 리스트 새로고침
            } catch(err) {
                console.error("승인 처리 실패", err);
                showAlert("승인 처리에 실패했습니다.");
            }
        }
    }

    // 퀵메뉴에서 탭 전환 유도
    const quickMenus = document.querySelectorAll('.menu-item');
    quickMenus.forEach((menu, index) => {
        menu.addEventListener('click', () => {
            // 자유게시판(index 1), 서식다운(index 2)
            if(index === 1) document.querySelector('.nav-item[data-target="board"]').click();
            else if(index === 2) document.querySelector('.nav-item[data-target="download"]').click();
        });
    });


    // ----------------------------------------------------
    // 4. 게시판 실시간 CRUD (Firestore)
    // ----------------------------------------------------
    const boardListContainer = document.querySelector('#section-board .list-card');
    
    // 플로팅 쓰기 버튼 이벤트
    if(fabBtn) {
        fabBtn.addEventListener('click', () => {
            openModal('write-modal');
        });
    }

    // 게시판 글 불러오기
    async function loadBoardPosts() {
        if(!window.keitiFirebase || !window.keitiFirebase.isInit) return;
        
        try {
            const fb = window.keitiFirebase;
            const q = fb.query(fb.collection(fb.db, "posts"), fb.orderBy("createdAt", "desc"));
            const querySnapshot = await fb.getDocs(q);
            
            boardListContainer.innerHTML = ''; // 초기화
            
            if(querySnapshot.empty) {
                boardListContainer.innerHTML = '<div style="padding: 20px; text-align:center; color:#999;">작성된 게시글이 없습니다.</div>';
                return;
            }

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // 날짜 포맷팅 로직
                let dateStr = "";
                if(data.createdAt) {
                    const dateObj = data.createdAt.toDate();
                    dateStr = `${dateObj.getFullYear()}.${String(dateObj.getMonth()+1).padStart(2,'0')}.${String(dateObj.getDate()).padStart(2,'0')}`;
                }

                const postHtml = `
                    <div class="board-item">
                        <h4>${escapeHtml(data.title)}</h4>
                        <div class="board-meta">
                            <span>작성자: ${escapeHtml(data.author)}</span> · <span>${dateStr}</span> · <span>조회 ${data.views || 0}</span>
                        </div>
                    </div>
                `;
                boardListContainer.insertAdjacentHTML('beforeend', postHtml);
            });
        } catch(error) {
            console.error("게시글 불러오기 실패:", error);
        }
    }

    // 새 글 등록하기
    if(addPostBtn) {
        addPostBtn.addEventListener('click', async () => {
            const title = document.getElementById('postTitle').value;
            const content = document.getElementById('postContent').value;

            if(!title || !content) {
                showAlert("제목과 내용을 모두 입력해주세요.");
                return;
            }

            addPostBtn.innerText = "등록 중...";

            // [Firebase Mode]
            if (window.keitiFirebase && window.keitiFirebase.isInit) {
                try {
                    const fb = window.keitiFirebase;
                    await fb.addDoc(fb.collection(fb.db, "posts"), {
                        title: title,
                        content: content,
                        author: currentUserName,
                        views: 0,
                        createdAt: fb.serverTimestamp()
                    });
                    
                    document.getElementById('postTitle').value = '';
                    document.getElementById('postContent').value = '';
                    closeModal('write-modal');
                    
                    // 목록 최신화
                    await loadBoardPosts();
                } catch(error) {
                    console.error("게시글 작성 실패:", error);
                    showAlert("글 작성에 실패했습니다.");
                } finally {
                    addPostBtn.innerText = "등록하기";
                }
            } else {
                // [UI Mock Mode]
                const today = new Date();
                const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`;
                
                mockPosts.unshift({
                    title: title, author: currentUserName, date: dateStr, views: 0
                });
                
                document.getElementById('postTitle').value = '';
                document.getElementById('postContent').value = '';
                closeModal('write-modal');
                renderMockPosts();
                
                addPostBtn.innerText = "등록하기";
            }
        });
    }

    // 목업 렌더링 함수
    function renderMockPosts() {
        if(!boardListContainer) return;
        boardListContainer.innerHTML = '';
        mockPosts.forEach(post => {
            const postHtml = `
                    <div class="board-item">
                        <h4>${escapeHtml(post.title)}</h4>
                        <div class="board-meta">
                            <span>작성자: ${escapeHtml(post.author)}</span> · <span>${post.date}</span> · <span>조회 ${post.views}</span>
                        </div>
                    </div>
            `;
            boardListContainer.insertAdjacentHTML('beforeend', postHtml);
        });
    }

    // 유틸: XSS 방지
    function escapeHtml(unsafe) {
        if(!unsafe) return "";
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
});
