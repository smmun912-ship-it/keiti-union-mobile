document.addEventListener('DOMContentLoaded', () => {
    
    // === 뷰 전환 관련 ===
    const loginView = document.getElementById('login-view');
    const mainView = document.getElementById('main-view');
    const loginBtn = document.getElementById('login-btn');

    // === 메인 페이지 내 섹션 전환 관련 ===
    const navItems = document.querySelectorAll('.nav-item');
    const sections = {
        'home': document.getElementById('section-home'),
        'board': document.getElementById('section-board'),
        'download': document.getElementById('section-download')
    };

    // 1. 로그인 로직 (간단한 목업)
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const id = document.getElementById('userId').value;
            const pw = document.getElementById('userPw').value;
            
            // ID, PW 입력만 확인
            if(id && pw) {
                // 로그인 화면 페이드아웃
                loginView.style.opacity = '0';
                setTimeout(() => {
                    loginView.classList.remove('active');
                    // 메인 화면 활성화
                    mainView.classList.add('active');
                }, 400); // CSS transition 시간에 맞춤
            } else {
                alert('사번과 비밀번호를 올바르게 입력해주세요.');
            }
        });
    }

    // 2. 하단 네비게이션 탭 동작
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 모든 탭의 active 클래스 제거
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // 클릭된 탭 활성화
            item.classList.add('active');
            
            // 연결된 데이터 타겟(섹션) 가져오기
            const target = item.getAttribute('data-target');
            
            if (target && sections[target]) {
                // 모든 섹션 숨기기
                Object.values(sections).forEach(sec => {
                    if (sec) {
                        sec.style.display = 'none';
                        sec.classList.remove('fade-in');
                    }
                });
                
                // 타겟 섹션만 보여주기
                sections[target].style.display = 'block';
                
                // 약간의 지연 후 애니메이션 위해 클래스 추가 (Reflow 유도)
                setTimeout(() => {
                    sections[target].classList.add('fade-in');
                }, 10);
            }
        });
    });

    // 3. 퀵메뉴에서 탭 전환 유도
    const quickMenus = document.querySelectorAll('.menu-item');
    quickMenus.forEach((menu, index) => {
        menu.addEventListener('click', () => {
            if(index === 1) { // 자유게시판 클릭 시
                document.querySelector('.nav-item[data-target="board"]').click();
            } else if (index === 2) { // 서식다운 클릭 시
                document.querySelector('.nav-item[data-target="download"]').click();
            }
        });
    });
});
