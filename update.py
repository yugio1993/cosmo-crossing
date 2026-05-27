import os

with open('game_v29.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update jump forces
code = code.replace('jumpForce: 14.2', 'jumpForce: 20.1')
code = code.replace('jumpForce: 11.5', 'jumpForce: 16.3')
code = code.replace('jumpForce: 17.5', 'jumpForce: 24.7')
code = code.replace('currentPlanet.jumpForce !== undefined ? currentPlanet.jumpForce : 14.2', 'currentPlanet.jumpForce !== undefined ? currentPlanet.jumpForce : 20.1')

# 2. Add worldTalkBubbleEl
code = code.replace("const btnTalkEl = document.getElementById('btn-talk');", "const btnTalkEl = document.getElementById('btn-talk');\nconst worldTalkBubbleEl = document.getElementById('world-talk-bubble');")

# 3. Hide worldTalkBubbleEl when dialog/warp is open or no villager is close
proximity_code = '''function checkVillagerProximity() {
    if (isDialogOpen || isWarpMenuOpen || isWarping) {
        btnTalkEl.style.display = "none";
        if(worldTalkBubbleEl) worldTalkBubbleEl.style.display = "none";
        btnWarpEl.style.display = "none";
        btnHarvestEl.style.display = "none";
        btnPresentEl.style.display = "none";
        return;
    }
    
    // 1. 住人接近およびプレゼント判定
    const result = findNearestVillager();
    if (result && result.dist <= 4.0 && result.villager.state !== "LEAVING") {
        btnTalkEl.style.display = "flex";
        
        // --- ここから追加 ---
        if(worldTalkBubbleEl) {
            worldTalkBubbleEl.style.display = "block";
            const vWorldPos = new THREE.Vector3();
            result.villager.group.getWorldPosition(vWorldPos);
            vWorldPos.add(result.villager.upDir.clone().multiplyScalar(1.5));
            vWorldPos.project(camera);
            
            const x = (vWorldPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (vWorldPos.y * -0.5 + 0.5) * window.innerHeight;
            
            worldTalkBubbleEl.style.left = `${x}px`;
            worldTalkBubbleEl.style.top = `${y}px`;
        }
        // --- ここまで追加 ---
        
        // プレイヤーが果物を持っている場合、プレゼントボタンを表示
        if (playerFruits > 0) {
            btnPresentEl.style.display = "flex";
        } else {
            btnPresentEl.style.display = "none";
        }
    } else {
        btnTalkEl.style.display = "none";
        if(worldTalkBubbleEl) worldTalkBubbleEl.style.display = "none";
        btnPresentEl.style.display = "none";
    }'''

old_proximity_code = '''function checkVillagerProximity() {
    if (isDialogOpen || isWarpMenuOpen || isWarping) {
        btnTalkEl.style.display = "none";
        btnWarpEl.style.display = "none";
        btnHarvestEl.style.display = "none";
        btnPresentEl.style.display = "none";
        return;
    }
    
    // 1. 住人接近およびプレゼント判定
    const result = findNearestVillager();
    if (result && result.dist <= 4.0 && result.villager.state !== "LEAVING") {
        btnTalkEl.style.display = "flex";
        
        // プレイヤーが果物を持っている場合、プレゼントボタンを表示
        if (playerFruits > 0) {
            btnPresentEl.style.display = "flex";
        } else {
            btnPresentEl.style.display = "none";
        }
    } else {
        btnTalkEl.style.display = "none";
        btnPresentEl.style.display = "none";
    }'''

if old_proximity_code in code:
    code = code.replace(old_proximity_code, proximity_code)
else:
    print("Warning: checkVillagerProximity block not found. Checking if spaces are different.")

code = code.replace("btnTalkEl.style.display = \"none\";", "btnTalkEl.style.display = \"none\";\n    if(worldTalkBubbleEl) worldTalkBubbleEl.style.display = \"none\";")
code = code.replace("btnTalkEl.style.display = 'none';", "btnTalkEl.style.display = 'none';\n    if(worldTalkBubbleEl) worldTalkBubbleEl.style.display = 'none';")

with open('game_v29.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Done")
