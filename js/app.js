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
    const fabBtn = document.getElementById('fab-board-write'); // 자유게시판 글쓰기
    const fabNewsBtn = document.getElementById('fab-news-write'); // 소식 글쓰기
    const addNewsBtn = document.getElementById('btn-submit-news');
    const fabBenefitsBtn = document.getElementById('fab-benefits-write'); // 조합원 혜택 글쓰기
    const addBenefitsBtn = document.getElementById('btn-submit-benefits');

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

    // 자동 로그인(세션 유지) 로직
    if (window.keitiFirebase && window.keitiFirebase.isInit) {
        const fb = window.keitiFirebase;
        fb.onAuthStateChanged(fb.auth, async (user) => {
            if (user && !currentUser) { // 이미 로그인 정보가 없는데 세션이 있다면
                try {
                    const userDoc = await fb.getDocFromServer(fb.doc(fb.db, "users", user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        const id = userData.empId;
                        if (id === "216008" || userData.status === 'approved') {
                            currentUser = userData;
                            if (id === "216008") {
                                currentUser.role = "부위원장";
                                currentUser.isAdmin = true;
                                currentUser.name = "문성만";
                            }
                            currentUserName = currentUser.name || id;
                            enterMainView();
                            loadBoardPosts();
                            loadNewsPosts();
                            loadBenefitsPosts();
                            loadSchedulePosts(); // 추가
                            loadHomeRecentPosts();
                        } else {
                            // 아직 승인이 안됐거나 거절되었다면 강제 로그아웃 
                            await fb.signOut(fb.auth);
                        }
                    } else if (user.email && user.email.includes("216008")) {
                        // 레거시 특별계정 처리
                        currentUser = { empId: "216008", name: "문성만", role: "부위원장", isAdmin: true, status: "approved" };
                        currentUserName = "문성만";
                        enterMainView();
                        loadBoardPosts();
                        loadNewsPosts();
                        loadBenefitsPosts();
                        loadSchedulePosts(); // 추가
                        loadHomeRecentPosts();
                    }
                } catch(e) {
                    console.error("세션 복구 오류", e);
                }
            }
        });
    }

    // ----------------------------------------------------
    // 1. 회원가입 로직 (Firebase Auth & Firestore)
    // ----------------------------------------------------
    if (signupBtn) {
        signupBtn.addEventListener('click', async () => {
            const id = document.getElementById('regId').value;
            const name = document.getElementById('regName').value;
            const dept = document.getElementById('regDept').value;
            const role = document.getElementById('regRole').value;
            const pw = document.getElementById('regPw').value;

            if(!id || !name || !dept || !role || pw.length < 6) {
                showAlert("직위, 소속부서를 포함한 모든 항목을 입력하고, 비밀번호는 6자리 이상 설정해주세요.");
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
                        dept: dept,
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

                    // Firestore에서 유저 상태(승인 여부) 확인 (서버 직접 조회 - 캐시 우회)
                    const userDoc = await fb.getDocFromServer(fb.doc(fb.db, "users", user.uid));
                    
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        
                        if (id === "216008" || userData.status === 'approved') {
                            currentUser = userData;
                            // 과거 가입으로 DB에 role/isAdmin 이 없는 경우 강제 부여하거나 덮어쓰기
                            if (id === "216008") {
                                currentUser.role = "부위원장";
                                currentUser.isAdmin = true;
                                currentUser.name = "문성만";
                            }
                            
                            currentUserName = currentUser.name || id; // 이름 fallback
                            enterMainView();
                            loadBoardPosts(); // 자유게시판 로드
                            loadNewsPosts();  // 노조 소식 로드
                            loadBenefitsPosts(); // 조합원 혜택 로드
                            loadSchedulePosts(); // 주요일정 로드
                            loadHomeRecentPosts(); // 홈 최근소식 통합 로드
                        } else if (userData.status === 'rejected') {
                            // 승인 거절
                            await fb.signOut(fb.auth);
                            showAlert("가입이 거절되었습니다. 관리자에게 문의해주세요.");
                        } else {
                            // 승인 대기
                            await fb.signOut(fb.auth);
                            showAlert("아직 관리자 승인 대기 중입니다. 승인 후 이용해주세요.");
                        }
                    } else {
                        // DB에 문서가 없어도 특별 계정인 경우 무사 통과
                        if (id === "216008") {
                            currentUser = { empId: "216008", name: "관리자", role: "부위원장", isAdmin: true, status: "approved" };
                            currentUserName = "관리자";
                            enterMainView();
                            loadBoardPosts();
                            loadNewsPosts();
                            loadBenefitsPosts();
                            loadSchedulePosts(); // 추가
                            loadHomeRecentPosts();
                        } else {
                            await fb.signOut(fb.auth);
                            showAlert("회원 정보를 찾을 수 없습니다.");
                        }
                    }
                } catch(error) {
                    console.error(error);
                    showAlert("로그인 실패. 사번이나 비밀번호를 확인해주세요.");
                } finally {
                    loginBtn.innerText = "로그인";
                }
            } else {
                // [UI Mock Mode] 무조건 통과 (테스트 뷰어용)
                currentUserName = id === 'admin' ? '관리자' : '체험자';
                enterMainView();
                renderMockPosts();
                loadBenefitsPosts();
                loadSchedulePosts(); // 추가
                loginBtn.innerText = "로그인";
            }
        });
    }

    function enterMainView() {
        // 홈 화면 이름 업데이트
        const heroName = document.querySelector('.hero-text h2 strong');
        const heroRoleObj = document.querySelector('.hero-text h2'); // 전체 h2 참조
        if(heroName) {
            heroName.innerText = currentUserName;
            let displayRole = currentUser && currentUser.role ? currentUser.role : "조합원";
            // innerHTML 덮어쓰기 (<strong> 보존)
            heroRoleObj.innerHTML = `안녕하세요, <strong>${currentUserName}</strong> ${displayRole}님`;
        }

        const adminMembersBtn = document.getElementById('header-admin-members');
        if (adminMembersBtn) {
            if (currentUser && currentUser.isAdmin) {
                adminMembersBtn.style.display = 'inline-block';
            } else {
                adminMembersBtn.style.display = 'none';
            }
        }

        loginView.style.opacity = '0';
        setTimeout(() => {
            loginView.classList.remove('active');
            mainView.classList.add('active');
        }, 400);
    }

    // ----------------------------------------------------
    // 3. 네비게이션 탭 동작
    // ----------------------------------------------------
    const navItems = document.querySelectorAll('.nav-item'); // (메뉴 삭제로 비어있을 수 있음)
    const headerLogo = document.getElementById('header-logo');
    const headerMyInfo = document.getElementById('header-myinfo');
    const sections = {
        'home': document.getElementById('section-home'),
        'board': document.getElementById('section-board'),
        'download': document.getElementById('section-download'),
        'myinfo': document.getElementById('section-myinfo'),
        'news': document.getElementById('section-news'),
        'benefits': document.getElementById('section-benefits'),
        'schedule': document.getElementById('section-schedule'),
        'gallery': document.getElementById('section-gallery'),
        'admin-members': document.getElementById('section-admin-members')
    };

    window.showSection = function(target) {
        if(!sections[target]) return;
        
        // 라우팅 활성화 UI 반전 (하단 메뉴가 있는 경우에만 동작)
        if(navItems.length > 0) {
            navItems.forEach(nav => nav.classList.remove('active'));
            const targetNav = document.querySelector(`.nav-item[data-target='${target}']`);
            if(targetNav) targetNav.classList.add('active');
        }
        
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

        // FAB 버튼 표시/숨김 관리
        if(fabBtn) fabBtn.style.display = (target === 'board') ? 'flex' : 'none';
        if(fabNewsBtn) fabNewsBtn.style.display = (target === 'news' && currentUser && currentUser.isAdmin) ? 'flex' : 'none';
        if(fabBenefitsBtn) fabBenefitsBtn.style.display = (target === 'benefits' && currentUser && currentUser.isAdmin) ? 'flex' : 'none';
        
        const fabScheduleBtn = document.getElementById('fab-schedule-write');
        if(fabScheduleBtn) fabScheduleBtn.style.display = (target === 'schedule' && currentUser && currentUser.isAdmin) ? 'flex' : 'none';
        
        const fabGalleryBtn = document.getElementById('fab-gallery-upload');
        if(fabGalleryBtn) {
            // 활동사진 업로드는 관리자만 가능하도록 설정. 필요시 조건 변경 가능.
            fabGalleryBtn.style.display = (target === 'gallery' && currentUser && currentUser.isAdmin) ? 'flex' : 'none';
        }

        if (target === 'myinfo') renderMyInfo();
        if (target === 'admin-members') loadApprovedMembers();
    };

    // 상단 로고 클릭 시 홈으로
    if(headerLogo) {
        headerLogo.addEventListener('click', () => showSection('home'));
    }

    // 상단 내 정보 버튼 클릭 시 내 정보 섹션으로
    if(headerMyInfo) {
        headerMyInfo.addEventListener('click', () => showSection('myinfo'));
    }

    // 상단 조합원 관리 버튼 클릭 시 관리자 섹션으로
    const headerAdminMembersBtn = document.getElementById('header-admin-members');
    if(headerAdminMembersBtn) {
        headerAdminMembersBtn.addEventListener('click', () => showSection('admin-members'));
    }

    // (기존 하단 메뉴 리스너 코드는 navItems가 비어있으면 안전함)
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');
            showSection(target);
        });
    });

    // --- 홈 화면 퀵메뉴 로직은 index.html의 onclick 속성으로 대체됨 ---

    // --- 내 정보 & 로그아웃 & 승인 로직 ---
    const btnEditDept = document.getElementById('btn-edit-dept');
    if(btnEditDept) {
        btnEditDept.addEventListener('click', async () => {
            if(!currentUser) return;
            const newDept = prompt("변경할 소속부서를 입력해주세요.", currentUser.dept || "");
            if(newDept !== null && newDept.trim() !== "") {
                if(window.keitiFirebase && window.keitiFirebase.isInit) {
                    try {
                        const fb = window.keitiFirebase;
                        const userRef = fb.doc(fb.db, "users", fb.auth.currentUser.uid);
                        await fb.updateDoc(userRef, { dept: newDept.trim() });
                        currentUser.dept = newDept.trim();
                        renderMyInfo();
                        showAlert("소속부서가 성공적으로 변경되었습니다.");
                    } catch(err) {
                        console.error("부서 변경 실패:", err);
                        showAlert("부서 변경에 실패했습니다. 권한이 부족하거나 통신 오류일 수 있습니다.");
                    }
                } else {
                    currentUser.dept = newDept.trim();
                    renderMyInfo();
                    showAlert("[테스트 모드] 소속부서 변경 완료");
                }
            }
        });
    }

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
        document.getElementById('info-dept').innerText = currentUser.dept || "미지정";
        
        let joinDateStr = "정보 없음";
        if(currentUser.createdAt) {
            const dateObj = currentUser.createdAt.toDate ? currentUser.createdAt.toDate() : new Date(currentUser.createdAt);
            joinDateStr = `${dateObj.getFullYear()}년 ${dateObj.getMonth()+1}월 ${dateObj.getDate()}일`;
        }
        document.getElementById('info-joindate').innerText = joinDateStr;

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
                                    <div style="display:flex; gap:5px;">
                                        <button class="btn btn-secondary" style="padding:6px 10px; font-size:12px;" onclick="rejectUser('${docSnap.id}')">거절</button>
                                        <button class="btn btn-primary" style="padding:6px 14px; font-size:12px;" onclick="approveUser('${docSnap.id}')">승인</button>
                                    </div>
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
                const docRef = fb.doc(fb.db, "users", docId);
                await fb.updateDoc(docRef, { status: 'approved' });
                
                // 승인이 실제로 서버 DB에 반영되었는지 검증 (캐시 우회)
                const verifySnap = await fb.getDocFromServer(docRef);
                if(verifySnap.exists() && verifySnap.data().status === 'approved') {
                    showAlert("승인 완료되었습니다. (" + (verifySnap.data().name || docId) + ")");
                } else {
                    showAlert("⚠️ 승인 요청은 전송되었으나 DB 반영 확인에 실패했습니다. 다시 시도해주세요.");
                }
                renderMyInfo(); // 리스트 새로고침
            } catch(err) {
                console.error("승인 처리 실패:", err.code, err.message, err);
                if(err.code === 'permission-denied') {
                    showAlert("권한이 부족합니다. Firebase Firestore 보안 규칙을 확인해주세요.");
                } else {
                    showAlert("승인 처리에 실패했습니다: " + err.message);
                }
            }
        }
    }

    // 전역 거절 함수 노출
    window.rejectUser = async function(docId) {
        if(!confirm("이 사용자의 가입을 거절하시겠습니까?")) return;

        if(window.keitiFirebase && window.keitiFirebase.isInit) {
            const fb = window.keitiFirebase;
            try {
                const docRef = fb.doc(fb.db, "users", docId);
                await fb.updateDoc(docRef, { status: 'rejected' });
                showAlert("가입이 거절되었습니다.");
                renderMyInfo(); // 리스트 새로고침
            } catch(err) {
                console.error("거절 처리 실패:", err.code, err.message, err);
                if(err.code === 'permission-denied') {
                    showAlert("권한이 부족합니다. Firebase Firestore 보안 규칙을 확인해주세요.");
                } else {
                    showAlert("거절 처리에 실패했습니다: " + err.message);
                }
            }
        }
    }

    // ----------------------------------------------------
    // [신규] 관리자 전용 전체 조합원 목록 로드
    // ----------------------------------------------------
    async function loadApprovedMembers() {
        const listContainer = document.getElementById('all-members-list');
        if (!listContainer || !currentUser || !currentUser.isAdmin) return;
        
        if(window.keitiFirebase && window.keitiFirebase.isInit) {
            const fb = window.keitiFirebase;
            try {
                // 승인된 회원만 조회 후 JS 메모리 상에서 정렬 (Firestore 인덱스 오류 회피)
                const q = fb.query(fb.collection(fb.db, "users"), fb.where("status", "==", "approved"));
                const querySnapshot = await fb.getDocs(q);
                listContainer.innerHTML = '';
                
                if(querySnapshot.empty) {
                    listContainer.innerHTML = '<div style="padding: 20px; text-align:center; color:#999;">가입된 조합원이 없습니다.</div>';
                    return;
                }

                let allMembers = [];
                querySnapshot.forEach((docSnap) => {
                    allMembers.push({ id: docSnap.id, ...docSnap.data() });
                });

                allMembers.sort((a, b) => {
                    const timeA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
                    const timeB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
                    return timeB - timeA;
                });
                
                let memberHTML = '';
                allMembers.forEach((data) => {
                    let dateStr = "알 수 없음";
                    if(data.createdAt) {
                        const dateObj = data.createdAt.toDate();
                        dateStr = `${dateObj.getFullYear()}.${String(dateObj.getMonth()+1).padStart(2,'0')}.${String(dateObj.getDate()).padStart(2,'0')}`;
                    }
                    memberHTML += `
                        <div style="border-bottom:1px solid #eee; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight:bold; font-size:15px; color:var(--text-main); margin-bottom: 4px;">
                                    ${escapeHtml(data.name)} <span style="font-size:12px; color:var(--primary-blue); font-weight:normal; margin-left:4px;">${escapeHtml(data.role)}</span>
                                </div>
                                <div style="font-size: 13px; color: var(--text-secondary);">
                                    사번: ${escapeHtml(data.empId)} | 부서: ${escapeHtml(data.dept || '미지정')}
                                </div>
                        </div>
                `;
                });
                listContainer.innerHTML = memberHTML;
            } catch(err) {
                console.error("전체 조합원 조회 실패:", err);
                listContainer.innerHTML = '<div style="padding: 20px; text-align:center; color:#e74c3c;">데이터를 불러오지 못했습니다.</div>';
            }
        } else {
            listContainer.innerHTML = '<div style="padding: 20px; text-align:center; color:#999;">DB 연결 안 됨</div>';
        }
    }

    const btnSubmitBenefits = document.getElementById('btn-submit-benefits');
    if(btnSubmitBenefits) {
        btnSubmitBenefits.addEventListener('click', async () => {
            if(!currentUser || !currentUser.isAdmin) {
                showAlert('관리자 권한이 필요합니다.');
                return;
            }
            const title = document.getElementById('benefitsTitle').value.trim();
            const content = document.getElementById('benefitsContent').value.trim();
            if(!title || !content) {
                showAlert('제목과 내용을 모두 입력해주세요.');
                return;
            }
            btnSubmitBenefits.innerText = "등록 중...";
            try {
                if(window.keitiFirebase && window.keitiFirebase.isInit) {
                    const fb = window.keitiFirebase;
                    await fb.addDoc(fb.collection(fb.db, "benefits"), {
                        title: title,
                        content: content,
                        author: currentUser.name || currentUserName || "관리자",
                        empId: currentUser.empId,
                        views: 0,
                        createdAt: fb.serverTimestamp()
                    });
                }
                closeModal('write-benefits-modal');
                showAlert('조합원 혜택 안내가 등록되었습니다.');
                loadBenefitsPosts();
                loadHomeRecentPosts();
            } catch(error) {
                console.error("혜택 등록 에러:", error);
                showAlert('혜택 등록에 실패했습니다.');
            } finally {
                btnSubmitBenefits.innerText = "혜택 등록하기";
            }
        });
    }

    const btnSubmitSchedule = document.getElementById('btn-submit-schedule');
    if(btnSubmitSchedule) {
        btnSubmitSchedule.addEventListener('click', async () => {
            if(!currentUser || !currentUser.isAdmin) {
                showAlert('관리자 권한이 필요합니다.');
                return;
            }
            const title = document.getElementById('scheduleTitle').value.trim();
            const date = document.getElementById('scheduleDate').value;
            const time = document.getElementById('scheduleTime').value;
            const location = document.getElementById('scheduleLocation').value.trim();
            const content = document.getElementById('scheduleContent').value.trim();
            if(!title || !date || !location) {
                showAlert('제목, 일자, 장소는 필수 입력사항입니다.');
                return;
            }

            const scheduleId = btnSubmitSchedule.getAttribute('data-edit-id');
            btnSubmitSchedule.innerText = "저장 중...";

            try {
                if(window.keitiFirebase && window.keitiFirebase.isInit) {
                    const fb = window.keitiFirebase;
                    const scheduleData = {
                        title: title,
                        date: date,
                        time: time,
                        location: location,
                        content: content,
                        updatedAt: fb.serverTimestamp()
                    };

                    if (scheduleId) {
                        // 수정 모드
                        await fb.updateDoc(fb.doc(fb.db, "schedule", scheduleId), scheduleData);
                        showAlert('주요일정이 수정되었습니다.');
                    } else {
                        // 신규 등록 모드
                        await fb.addDoc(fb.collection(fb.db, "schedule"), {
                            ...scheduleData,
                            author: currentUser.name || currentUserName || "관리자",
                            empId: currentUser.empId,
                            views: 0,
                            createdAt: fb.serverTimestamp()
                        });
                        showAlert('주요일정이 등록되었습니다.');
                    }
                }
                closeModal('write-schedule-modal');
                btnSubmitSchedule.removeAttribute('data-edit-id');
                loadSchedulePosts();
                loadHomeRecentPosts();
            } catch(error) {
                console.error("일정 저장 에러:", error);
                showAlert('일정 저장에 실패했습니다.');
            } finally {
                btnSubmitSchedule.innerText = "일정 등록하기";
            }
        });
    }

    async function loadSchedulePosts() {
        const listContainer = document.getElementById('schedule-list-container');
        if(!listContainer) return;
        
        if (window.keitiFirebase && window.keitiFirebase.isInit) {
            try {
                const fb = window.keitiFirebase;
                const q = fb.query(fb.collection(fb.db, "schedule"), fb.orderBy("date", "desc"));
                const querySnapshot = await fb.getDocs(q);
                
                listContainer.innerHTML = '';
                
                if(querySnapshot.empty) {
                    listContainer.innerHTML = '<div style="padding: 20px; text-align:center; color:#999;">등록된 일정이 없습니다.</div>';
                    return;
                }
                
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    
                    const timeStr = data.time ? ` · ${data.time}` : '';
                    let dateStr = "미정";
                    if(data.date) {
                        const d = new Date(data.date);
                        dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
                    }
                    
                    const postHTML = `
                        <div class="list-item" onclick="viewPostDetail('${doc.id}', 'schedule')" style="cursor:pointer;">
                            <div class="tag tag-outline">일정</div>
                            <div class="item-content" style="flex:1;">
                                <h4>${escapeHtml(data.title)}</h4>
                                <div class="date" style="color:var(--primary-blue); font-weight:600;"><i class="fa-regular fa-calendar-check"></i> ${dateStr}${timeStr}</div>
                                <div class="date">${escapeHtml(data.author)} · 장소: ${escapeHtml(data.location || '미정')}</div>
                            </div>
                        </div>
                    `;
                    listContainer.insertAdjacentHTML('beforeend', postHTML);
                });

            } catch(error) {
                console.error("주요일정 로드 에러:", error);
                listContainer.innerHTML = '<div style="padding: 20px; text-align:center; color:#ef4444;">데이터를 불러오는 데 실패했습니다.</div>';
            }
        } else {
            listContainer.innerHTML = '<div style="padding: 20px; text-align:center; color:#999;">[오프라인 테스트] 일정이 없습니다.</div>';
        }
    }

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
            
            boardListContainer.innerHTML = '';

            if(querySnapshot.empty) {
                boardListContainer.innerHTML = '<div style="padding: 20px; text-align:center; color:#999;">작성된 게시글이 없습니다.</div>';
                return;
            }

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                let dateStr = "";
                if(data.createdAt) {
                    const dateObj = data.createdAt.toDate();
                    dateStr = `${dateObj.getFullYear()}.${String(dateObj.getMonth()+1).padStart(2,'0')}.${String(dateObj.getDate()).padStart(2,'0')}`;
                }

                const boardItem = document.createElement('div');
                boardItem.className = 'board-item';
                boardItem.style.cursor = 'pointer';
                boardItem.innerHTML = `
                    <h4>${escapeHtml(data.title)}</h4>
                    <div class="board-meta">
                        <span>작성자: ${escapeHtml(data.author)}</span> · <span>${dateStr}</span> · <span>조회 ${data.views || 0}</span>
                    </div>
                `;
                boardItem.addEventListener('click', () => openPostDetail(doc.id, 'posts'));
                boardListContainer.appendChild(boardItem);
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
                        empId: currentUser ? currentUser.empId : "",
                        views: 0,
                        createdAt: fb.serverTimestamp()
                    });
                    
                    document.getElementById('postTitle').value = '';
                    document.getElementById('postContent').value = '';
                    closeModal('write-modal');
                    
                    // 목록 최신화
                    await loadBoardPosts();
                    await loadHomeRecentPosts();
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

    // ----------------------------------------------------
    // 5. 노조 소식(공지사항) 실시간 CRUD (Firestore)
    // ----------------------------------------------------
    const newsListContainer = document.getElementById('news-list-container');
    
    // 노조소식 글 불러오기
    async function loadNewsPosts() {
        if(!window.keitiFirebase || !window.keitiFirebase.isInit) return;

        try {
            const fb = window.keitiFirebase;
            const q = fb.query(fb.collection(fb.db, "news"), fb.orderBy("createdAt", "desc"));
            const querySnapshot = await fb.getDocs(q);
            
            if(newsListContainer) newsListContainer.innerHTML = '';

            if(querySnapshot.empty) {
                if(newsListContainer) newsListContainer.innerHTML = '<div style="padding: 20px; text-align:center; color:#999;">작성된 노조 소식이 없습니다.</div>';
                return;
            }

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                let dateStr = "";
                if(data.createdAt) {
                    const dateObj = data.createdAt.toDate();
                    dateStr = `${dateObj.getFullYear()}.${String(dateObj.getMonth()+1).padStart(2,'0')}.${String(dateObj.getDate()).padStart(2,'0')}`;
                }

                if(newsListContainer) {
                    const newsItem = document.createElement('div');
                    newsItem.className = 'list-item';
                    newsItem.style.cssText = 'border-bottom: 1px solid #eee; padding:15px; display:flex; gap:10px; align-items:flex-start; cursor:pointer;';
                    newsItem.innerHTML = `
                        <div class="tag tag-primary" style="flex-shrink:0;">소식</div>
                        <div class="item-content" style="flex-grow:1;">
                            <h4 style="margin:0 0 5px 0; font-size:15px; color:var(--text-main);">${escapeHtml(data.title)}</h4>
                            <span class="date" style="font-size:12px; color:var(--text-light);">${dateStr} · <strong>${escapeHtml(data.author)}</strong> · 조회 ${data.views || 0}</span>
                        </div>
                    `;
                    newsItem.addEventListener('click', () => openPostDetail(doc.id, 'news'));
                    newsListContainer.appendChild(newsItem);
                }
            });
        } catch(error) {
            console.error("소식 불러오기 실패:", error);
        }
    }

    // ----------------------------------------------------
    // 6. 조합원 혜택 실시간 CRUD (Firestore)
    // ----------------------------------------------------
    const benefitsListContainer = document.getElementById('benefits-list-container');
    
    async function loadBenefitsPosts() {
        if(!window.keitiFirebase || !window.keitiFirebase.isInit) return;
        
        // 관리자 직위판별 (로직)
        if(fabBenefitsBtn && currentUser && currentUser.isAdmin) {
            fabBenefitsBtn.style.display = 'flex';
        } else if(fabBenefitsBtn) {
            fabBenefitsBtn.style.display = 'none';
        }

        try {
            const fb = window.keitiFirebase;
            const q = fb.query(fb.collection(fb.db, "benefits"), fb.orderBy("createdAt", "desc"));
            const querySnapshot = await fb.getDocs(q);
            
            if(benefitsListContainer) benefitsListContainer.innerHTML = '';
            
            if(querySnapshot.empty) {
                if(benefitsListContainer) benefitsListContainer.innerHTML = '<div style="padding: 20px; text-align:center; color:#999;">혜택 안내가 없습니다.</div>';
                return;
            }

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                let dateStr = "";
                if(data.createdAt) {
                    const dateObj = data.createdAt.toDate();
                    dateStr = `${dateObj.getFullYear()}.${String(dateObj.getMonth()+1).padStart(2,'0')}.${String(dateObj.getDate()).padStart(2,'0')}`;
                }

                if(benefitsListContainer) {
                    const bnItem = document.createElement('div');
                    bnItem.className = 'list-item';
                    bnItem.style.cssText = 'border-bottom: 1px solid #eee; padding:15px; display:flex; gap:10px; align-items:flex-start; cursor:pointer;';
                    bnItem.innerHTML = `
                        <div class="tag tag-primary" style="flex-shrink:0; background-color: var(--primary-purple);">혜택</div>
                        <div class="item-content" style="flex-grow:1;">
                            <h4 style="margin:0 0 5px 0; font-size:15px; color:var(--text-main);">${escapeHtml(data.title)}</h4>
                            <span class="date" style="font-size:12px; color:var(--text-light);">${dateStr} · <strong>${escapeHtml(data.author)}</strong> · 조회 ${data.views || 0}</span>
                        </div>
                    `;
                    bnItem.addEventListener('click', () => openPostDetail(doc.id, 'benefits'));
                    benefitsListContainer.appendChild(bnItem);
                }
            });
        } catch(error) {
            console.error("혜택 불러오기 실패:", error);
        }
    }

    // ----------------------------------------------------
    // 7. 홈 최근 소식 통합 로드 (posts + news + benefits 합산, 시간순 정렬)
    // ----------------------------------------------------
    async function loadHomeRecentPosts() {
        const homeRecentContainer = document.getElementById('home-recent-posts');
        if(!homeRecentContainer) return;
        if(!window.keitiFirebase || !window.keitiFirebase.isInit) return;

        const fb = window.keitiFirebase;
        let allItems = [];

        try {
            // 자유게시판
            const postsSnap = await fb.getDocs(fb.query(fb.collection(fb.db, "posts"), fb.orderBy("createdAt", "desc")));
            postsSnap.forEach(doc => {
                const d = doc.data();
                allItems.push({ id: doc.id, collection: 'posts', tag: '자유', tagClass: 'tag-outline', ...d });
            });

            // 노조 소식
            const newsSnap = await fb.getDocs(fb.query(fb.collection(fb.db, "news"), fb.orderBy("createdAt", "desc")));
            newsSnap.forEach(doc => {
                const d = doc.data();
                allItems.push({ id: doc.id, collection: 'news', tag: '소식', tagClass: 'tag-primary', ...d });
            });

            // 조합원 혜택
            const benefitsSnap = await fb.getDocs(fb.query(fb.collection(fb.db, "benefits"), fb.orderBy("createdAt", "desc")));
            benefitsSnap.forEach(doc => {
                const d = doc.data();
                allItems.push({ id: doc.id, collection: 'benefits', tag: '혜택', tagClass: 'tag-primary" style="background-color:var(--accent-purple);color:white;', ...d });
            });
        } catch(e) {
            console.error('홈 최근소식 로드 실패:', e);
        }

        // 시간순 정렬 (최신이 맨 위)
        allItems.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toDate().getTime() : 0;
            const timeB = b.createdAt ? b.createdAt.toDate().getTime() : 0;
            return timeB - timeA;
        });

        homeRecentContainer.innerHTML = '';

        if(allItems.length === 0) {
            homeRecentContainer.innerHTML = '<div style="padding: 20px; text-align:center; color:#999;">최근 소식이 없습니다.</div>';
            return;
        }

        // 최대 5개만 표시
        const displayItems = allItems.slice(0, 5);
        displayItems.forEach(item => {
            let dateStr = '';
            if(item.createdAt) {
                const dateObj = item.createdAt.toDate();
                dateStr = `${dateObj.getFullYear()}.${String(dateObj.getMonth()+1).padStart(2,'0')}.${String(dateObj.getDate()).padStart(2,'0')}`;
            }
            const el = document.createElement('div');
            el.className = 'list-item';
            el.style.cursor = 'pointer';
            el.innerHTML = `
                <div class="tag ${item.tagClass}">${item.tag}</div>
                <div class="item-content">
                    <h4>${escapeHtml(item.title)}</h4>
                    <span class="date">${dateStr}</span>
                </div>
            `;
            el.addEventListener('click', () => openPostDetail(item.id, item.collection));
            homeRecentContainer.appendChild(el);
        });
    }

    // 전역 상태: 현재 열려있는 게시글 정보 (삭제 기능 처리용)
    let currentOpenPostInfo = { id: null, collection: null };

    // 전역 상세 보기 함수
    window.openPostDetail = async function(docId, collectionName) {
        if(!window.keitiFirebase || !window.keitiFirebase.isInit) return;
        const fb = window.keitiFirebase;

        try {
            const docRef = fb.doc(fb.db, collectionName, docId);
            const docSnap = await fb.getDoc(docRef);

            if(docSnap.exists()) {
                const data = docSnap.data();
                
                // 로컬스토리지 이용한 동일글 조회수 어뷰징 방지
                let newViews = data.views || 0;
                let viewedPosts = [];
                try {
                    viewedPosts = JSON.parse(localStorage.getItem('keiti_viewed_posts')) || [];
                } catch(e) {}

                if (!viewedPosts.includes(docId)) {
                    newViews += 1;
                    viewedPosts.push(docId);
                    localStorage.setItem('keiti_viewed_posts', JSON.stringify(viewedPosts));
                    // 조회수 즉각 업데이트
                    await fb.updateDoc(docRef, { views: newViews });
                }

                // UI 모달에 세팅
                document.getElementById('detail-title').innerText = data.title;
                document.getElementById('detail-author').innerText = data.author || '알 수 없음';
                
                let dateStr = "";
                if(data.createdAt) {
                    const dateObj = data.createdAt.toDate();
                    dateStr = `${dateObj.getFullYear()}.${String(dateObj.getMonth()+1).padStart(2,'0')}.${String(dateObj.getDate()).padStart(2,'0')}`;
                }
                document.getElementById('detail-date').innerText = dateStr;
                document.getElementById('detail-views').innerText = newViews;
                let detailContentStr = escapeHtml(data.content || '').replace(/\n/g, '<br>');
                
                // 일정이면 부가 정보(일자, 시간, 장소)를 본문 상단에 추가 노출
                if (collectionName === 'schedule') {
                    const schDate = escapeHtml(data.date || '미정');
                    const schTime = escapeHtml(data.time || '미정');
                    const schLocation = escapeHtml(data.location || '미정');
                    
                    const extraHTML = `
                        <div style="background:#f9fafb; padding:15px; border-radius:10px; margin-bottom:20px; border:1px solid #eee;">
                            <div style="margin-bottom:8px;"><strong><i class="fa-solid fa-calendar-day"></i> 일자 및 시간:</strong> ${schDate} ${schTime}</div>
                            <div><strong><i class="fa-solid fa-location-dot"></i> 장소:</strong> ${schLocation}</div>
                        </div>
                    `;
                    detailContentStr = extraHTML + detailContentStr;
                }
                
                document.getElementById('detail-content').innerHTML = detailContentStr;

                // 수정/삭제 권한: 본인이 작성자이거나 (단순히 작성자 이름 비교) empId가 같거나
                const authorCheck = (currentUser && currentUser.name === data.author);
                const empIdCheck = (data.empId && currentUser && data.empId === currentUser.empId);
                
                const deleteBtn = document.getElementById('btn-delete-post');
                const editBtn = document.getElementById('btn-edit-post');
                
                if (deleteBtn) deleteBtn.style.display = (authorCheck || empIdCheck) ? 'inline-block' : 'none';
                if (editBtn) {
                    // 주요일정과 자유게시판 모두 수정 가능하게 하려면 여기서 조절. 일단 주요일정만 요청받았으므로 schedule인 경우에만 노출하거나 전체 허용.
                    // 자유게시판도 수정 기능이 있으면 좋으므로 전체 허용 (단, 수정 로직이 구현된 경우만)
                    if (collectionName === 'schedule' && (authorCheck || empIdCheck)) {
                        editBtn.style.display = 'inline-block';
                        // 기존 리스너 제거 위해 클론 처리 (이벤트 중복 방지)
                        const newEditBtn = editBtn.cloneNode(true);
                        editBtn.parentNode.replaceChild(newEditBtn, editBtn);
                        newEditBtn.addEventListener('click', () => {
                            if (collectionName === 'schedule') {
                                openEditScheduleModal(docId, data);
                            } else {
                                showAlert("이 게시판은 아직 수정 기능을 지원하지 않습니다.");
                            }
                        });
                    } else {
                        editBtn.style.display = 'none';
                    }
                }

                currentOpenPostInfo = { id: docId, collection: collectionName };

                openModal('post-detail-modal');

                // 리스트 배경 최신화를 위해 데이터 리로드 호출
                if(collectionName === 'posts') loadBoardPosts();
                if(collectionName === 'news') loadNewsPosts();
                if(collectionName === 'benefits') loadBenefitsPosts();
                if(collectionName === 'schedule') loadSchedulePosts();
                loadHomeRecentPosts();
            } else {
                showAlert("존재하지 않거나 삭제된 게시물입니다.");
            }
        } catch(err) {
            console.error("상세보기 에러:", err);
            showAlert("상세 내용을 불러올 수 없습니다.");
        }
    }

    if(fabNewsBtn) {
        fabNewsBtn.addEventListener('click', () => {
            openModal('write-news-modal');
        });
    }

    if(addNewsBtn) {
        addNewsBtn.addEventListener('click', async () => {
            const title = document.getElementById('newsTitle').value;
            const content = document.getElementById('newsContent').value;

            if(!title || !content) {
                showAlert("제목과 내용을 모두 입력해주세요.");
                return;
            }

            addNewsBtn.innerText = "발행 중...";

            if (window.keitiFirebase && window.keitiFirebase.isInit) {
                try {
                    const fb = window.keitiFirebase;
                    await fb.addDoc(fb.collection(fb.db, "news"), {
                        title: title,
                        content: content,
                        author: currentUserName,
                        empId: currentUser ? currentUser.empId : "",
                        views: 0,
                        createdAt: fb.serverTimestamp()
                    });
                    
                    document.getElementById('newsTitle').value = '';
                    document.getElementById('newsContent').value = '';
                    closeModal('write-news-modal');
                    
                    await loadNewsPosts(); // 소식 리로드
                    await loadHomeRecentPosts();
                } catch(error) {
                    console.error("소식 작성 실패:", error);
                    showAlert("글 작성에 실패했습니다.");
                } finally {
                    addNewsBtn.innerText = "소식 발행하기";
                }
            }
        });
    }

    // ----------------------------------------------------
    // 7. 조합원 혜택 등록 및 게시글 전역 삭제 이벤트
    // ----------------------------------------------------
    if(fabBenefitsBtn) {
        fabBenefitsBtn.addEventListener('click', () => {
            document.getElementById('benefitsTitle').value = '';
            document.getElementById('benefitsContent').value = '';
            openModal('write-benefits-modal');
        });
    }

    const fabScheduleBtn = document.getElementById('fab-schedule-write');
    if(fabScheduleBtn) {
        fabScheduleBtn.addEventListener('click', () => {
            document.getElementById('scheduleTitle').value = '';
            document.getElementById('scheduleContent').value = '';
            openModal('write-schedule-modal');
        });
    }

    if(addBenefitsBtn) {
        addBenefitsBtn.addEventListener('click', async () => {
            const title = document.getElementById('benefitsTitle').value;
            const content = document.getElementById('benefitsContent').value;

            if(!title || !content) {
                showAlert("제목과 혜택 내용을 모두 입력해주세요.");
                return;
            }

            addBenefitsBtn.innerText = "등록 중...";

            if (window.keitiFirebase && window.keitiFirebase.isInit) {
                try {
                    const fb = window.keitiFirebase;
                    await fb.addDoc(fb.collection(fb.db, "benefits"), {
                        title: title,
                        content: content,
                        author: currentUserName,
                        empId: currentUser ? currentUser.empId : "",
                        views: 0,
                        createdAt: fb.serverTimestamp()
                    });
                    
                    document.getElementById('benefitsTitle').value = '';
                    document.getElementById('benefitsContent').value = '';
                    closeModal('write-benefits-modal');
                    
                    await loadBenefitsPosts();
                    await loadHomeRecentPosts();
                } catch(error) {
                    console.error("혜택 등록 실패:", error);
                    showAlert("혜택 등록에 실패했습니다.");
                } finally {
                    addBenefitsBtn.innerText = "혜택 등록하기";
                }
            }
        });
    }

    if (btnDeletePost) {
        btnDeletePost.addEventListener('click', async () => {
            if(!currentOpenPostInfo.id || !currentOpenPostInfo.collection) return;
            if(!confirm("이 게시글을 삭제하시겠습니까? 삭제된 글은 복구할 수 없습니다.")) return;

            if (window.keitiFirebase && window.keitiFirebase.isInit) {
                try {
                    const fb = window.keitiFirebase;
                    await fb.deleteDoc(fb.doc(fb.db, currentOpenPostInfo.collection, currentOpenPostInfo.id));
                    
                    closeModal('post-detail-modal');
                    showAlert("글이 정상적으로 삭제되었습니다.");
                    
                    // 새로고침 로드
                    if (currentOpenPostInfo.collection === 'posts') await loadBoardPosts();
                    if (currentOpenPostInfo.collection === 'news') await loadNewsPosts();
                    if (currentOpenPostInfo.collection === 'benefits') await loadBenefitsPosts();
                    if (currentOpenPostInfo.collection === 'schedule') await loadSchedulePosts();
                    await loadHomeRecentPosts();
                    currentOpenPostInfo = { id: null, collection: null };
                } catch(error) {
                    console.error("게시글 삭제 실패:", error);
                    showAlert("삭제 중 오류가 발생했습니다.");
                }
            }
        });
    }

    // 주요일정 수정 모달 열기
    function openEditScheduleModal(docId, data) {
        closeModal('post-detail-modal');
        
        document.getElementById('scheduleTitle').value = data.title || '';
        document.getElementById('scheduleDate').value = data.date || '';
        document.getElementById('scheduleTime').value = data.time || '';
        document.getElementById('scheduleLocation').value = data.location || '';
        document.getElementById('scheduleContent').value = data.content || '';
        
        const submitBtn = document.getElementById('btn-submit-schedule');
        submitBtn.innerText = "일정 수정하기";
        submitBtn.setAttribute('data-edit-id', docId);
        
        openModal('write-schedule-modal');
    }

    // 유틸: XSS 방지
    function escapeHtml(unsafe) {
        if(unsafe === null || unsafe === undefined) return "";
        return String(unsafe)
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
});
