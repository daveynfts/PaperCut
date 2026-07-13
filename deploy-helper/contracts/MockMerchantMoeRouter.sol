// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MockMerchantMoeRouter {
    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        string tokenOutSymbol,
        uint256 amountIn,
        uint256 amountOutSimulated
    );

    event SwapMNTExecuted(
        address indexed user,
        string tokenOutSymbol,
        uint256 amountInMNT,
        uint256 amountOutSimulated
    );

    // Simple swap function that takes input token (like $DAVEY) and simulates swap output
    function swap(
        address tokenIn,
        uint256 amountIn,
        string calldata tokenOutSymbol,
        address to
    ) external returns (uint256 simulatedAmountOut) {
        require(amountIn > 0, "Amount must be greater than 0");
        
        // Transfer the input token from the user to this contract
        bool success = IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        require(success, "Token transfer failed");

        // Simulate a swap output
        simulatedAmountOut = amountIn; // Simple 1-to-1 simulation for rating calculation

        emit SwapExecuted(to, tokenIn, tokenOutSymbol, amountIn, simulatedAmountOut);
        return simulatedAmountOut;
    }

    // Simple swap function that takes native MNT and simulates swap output
    function swapMNT(
        string calldata tokenOutSymbol,
        address to
    ) external payable returns (uint256 simulatedAmountOut) {
        require(msg.value > 0, "Amount must be greater than 0");

        // Simulate a swap output (e.g. 1 MNT = 1 Simulated Token)
        simulatedAmountOut = msg.value;

        emit SwapMNTExecuted(to, tokenOutSymbol, msg.value, simulatedAmountOut);
        return simulatedAmountOut;
    }
}
